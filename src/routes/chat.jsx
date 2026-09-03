import { createFileRoute } from "@tanstack/react-router";
import { Send, Trash2, Sparkles, Bot, User, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PhoneShell, StatusBar, ThemeToggle } from "@/components/ui-kit";
import { RemoteState, useRemoteData } from "@/hooks/use-app-data";
import { fetchMessages, sendMessage } from "@/lib/data";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export const Route = createFileRoute("/chat")({
  head: () => ({ meta: [{ title: "محادثة فزعة | جوك" }] }),
  component: ChatScreen,
});

const FAZAA_PRIVATE_MATCH_ID = "00000000-0000-0000-0000-0000000000FA"; // قناة خاصة مع البوت

function formatTime(iso) {
  if (!iso) return "الآن";
  try { return new Date(iso).toLocaleTimeString("ar-IQ", { hour: "numeric", minute: "2-digit", hour12: true }); } catch { return "الآن"; }
}

function ChatScreen() {
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const [userId, setUserId] = useState(null);
  const [selectedMessageId, setSelectedMessageId] = useState(null);

  const messagesState = useRemoteData(() => {
    return fetchMessages(FAZAA_PRIVATE_MATCH_ID);
  }, []);
  const messages = messagesState.data ?? [];

  useEffect(() => {
    supabase?.auth.getSession().then(({ data }) => { 
      const id = data?.session?.user?.id; 
      if (id && id !== 'undefined') setUserId(id); 
    });
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const reloadRef = useRef(messagesState.reload);
  useEffect(() => { reloadRef.current = messagesState.reload; });

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    const ch = supabase.channel(`fazaa-private`).on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => reloadRef.current?.()).subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const handleSend = async (textToSend) => {
    const body = (textToSend || messageText).trim(); 
    if (!body) return;
    setSending(true);
    try { 
      await sendMessage({ matchId: FAZAA_PRIVATE_MATCH_ID, body }); 
      setMessageText(""); 
      await messagesState.reload(); 

      // رد تجريبي فوري من فزعة
      setTimeout(async () => {
        await sendMessage({ 
          matchId: FAZAA_PRIVATE_MATCH_ID, 
          body: `🤖 أهلاً بك يا بارق! استلمت رسالتك وجاي أجهز لك الطلب بسرعة.. ⚡`,
          senderId: "00000000-0000-0000-0000-0000000000FA"
        });
        await messagesState.reload();
      }, 1000);

    } catch (e) { 
      toast.error(e.message); 
    } finally { 
      setSending(false); 
    }
  };

  const handleDelete = async (msgId) => {
    if (!msgId) return;
    try { 
      await supabase.from('messages').delete().eq('id', msgId); 
      await messagesState.reload(); 
      toast.success("تم الحذف");
    } catch { 
      toast.error("فشل الحذف"); 
    }
  };

  // قائمة الاقتراحات السريعة الظاهرة فوق شريط الإرسال
  const quickSuggestions = [
    "كفل لي لعبة 5×5 الليلة بمنطقتي",
    "منو أنشط لاعبين قربي الآن؟",
    "اقترح لي 3 مناطق مناسبة للحجز"
  ];

  return (
    <PhoneShell withNav>
      <StatusBar />
      
      {/* --- الهيدر بتصميم سيساف المتناسق --- */}
      <header dir="rtl" className="flex items-center justify-between border-b border-[#0d3b2c] bg-[#041c14] px-4 py-3 shadow-md">
        <ThemeToggle className="h-9 w-9 rounded-full border border-[#0d3b2c] bg-[#072c20] text-emerald-400" />
        
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.3)]">
            <Bot className="h-5 w-5" />
          </div>
          <div className="flex flex-col text-right">
            <h1 className="text-sm font-bold tracking-wide text-white flex items-center gap-1">
              شات فزعة <Sparkles className="h-3 w-3 text-emerald-400" />
            </h1>
            <span className="text-[10px] text-emerald-400 font-medium">محادثة خاصة بينك وبين البوت</span>
          </div>
        </div>

        <div className="w-9" /> 
      </header>

      {/* --- منطقة الدردشة --- */}
      <div dir="rtl" className="flex-1 space-y-3.5 overflow-y-auto bg-[#041c14] p-4 font-sans text-white">
        <RemoteState {...messagesState} empty={!messages.length}>
          <>
            {/* رسالة ترحيبية أولية ثابتة */}
            <div className="flex flex-col items-start">
              <div className="flex max-w-[85%] items-end gap-2 flex-row-reverse">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-900/80 text-emerald-300 border border-emerald-500/30 text-xs">
                  🤖
                </div>
                <div className="rounded-2xl rounded-bl-sm border border-emerald-500/30 bg-[#072c20] px-4 py-3 text-xs leading-relaxed text-emerald-100 shadow-md">
                  هلا بيك 👋 آني شات فزعة. أكفل ربعك بسرعة: أجمع المنشطين بمنطقتك، أرتب اللعبة وأقترح الملعب والوقت. شتحب نسوي؟
                </div>
              </div>
              <span className="pl-9 pt-1 text-[10px] text-emerald-500/70">الآن</span>
            </div>

            {messages.map((m, i) => {
              const isMine = m.mine || (userId && m.sender_id === userId);
              const isBot = m.sender_id === "00000000-0000-0000-0000-0000000000FA" || m.text?.startsWith('🤖');
              
              return (
                <div key={m.id || i} className={`group flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                  <div className={`flex max-w-[85%] items-end gap-2 ${isMine ? "flex-row" : "flex-row-reverse"}`}>
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-xs">
                      {isBot ? "🤖" : <User className="h-3.5 w-3.5" />}
                    </div>
                    <div 
                      className={`relative inline-block w-fit cursor-pointer rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-md whitespace-pre-wrap break-words transition-all ${
                        isBot 
                          ? "rounded-bl-sm border border-emerald-500/40 bg-[#072c20] text-emerald-100" 
                          : isMine 
                            ? "rounded-br-sm bg-emerald-500 text-[#032015] font-semibold" 
                            : "rounded-bl-sm border border-slate-700 bg-slate-800 text-slate-200"
                      } ${selectedMessageId === (m.id || i) ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#041c14]" : ""}`} 
                      onClick={() => setSelectedMessageId(selectedMessageId === (m.id || i) ? null : (m.id || i))}
                    >
                      <span>{m.text || m.body}</span>
                      {isMine && selectedMessageId === (m.id || i) && (
                        <button aria-label="حذف الرسالة" onClick={(e) => { e.stopPropagation(); handleDelete(m.id); setSelectedMessageId(null); }} className="absolute -left-9 top-1/2 -translate-y-1/2 rounded-full bg-slate-800 p-1.5 shadow-md border border-slate-700">
                          <Trash2 className="h-3 w-3 text-red-400" />
                        </button>
                      )}
                    </div>
                  </div>
                  <span className={`pt-1 text-[10px] text-emerald-500/60 ${isMine ? "pr-9" : "pl-9"}`}>{formatTime(m.created_at)}</span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        </RemoteState>
      </div>

      {/* --- شريط الاقتراحات السريعة (من التصميم الجديد) --- */}
      <div dir="rtl" className="bg-[#041c14] px-3 pt-2 pb-1 border-t border-[#0d3b2c]/40 flex gap-2 overflow-x-auto no-scrollbar">
        {quickSuggestions.map((suggestion, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(suggestion)}
            className="shrink-0 rounded-full border border-emerald-500/30 bg-[#072c20] px-3 py-1.5 text-[11px] text-emerald-200 hover:bg-emerald-900/50 transition-colors"
          >
            {suggestion}
          </button>
        ))}
      </div>

      {/* --- شريط الإرسال السفلي --- */}
      <div dir="rtl" className="flex items-center gap-2 bg-[#041c14] p-3">
        <div className="relative flex-1 flex items-center">
          <span className="absolute right-3 text-emerald-400/70">
            <Zap className="h-4 w-4" />
          </span>
          <input 
            value={messageText} 
            onChange={e => setMessageText(e.target.value)} 
            onKeyDown={e => e.key === "Enter" && handleSend()} 
            placeholder="اكتب: كفل لي لعبة الليلة..." 
            className="w-full rounded-xl border border-[#0d3b2c] bg-[#072c20] pr-9 pl-4 py-3 text-xs text-white outline-none placeholder:text-emerald-500/50 focus:border-emerald-500" 
          />
        </div>
        <button 
          aria-label="إرسال الرسالة" 
          onClick={() => handleSend()} 
          disabled={sending || !messageText.trim()} 
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-[#032015] transition-transform active:scale-95 disabled:opacity-30 cursor-pointer shadow-md"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </PhoneShell>
  );
}
