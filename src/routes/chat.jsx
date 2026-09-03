import { createFileRoute } from "@tanstack/react-router";
import { Send, Trash2, Sparkles, User, Zap } from "lucide-react";
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

const FAZAA_PRIVATE_MATCH_ID = "00000000-0000-0000-0000-0000000000FA"; // قناة خاصة مع المنظم

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

  // قائمة الاقتراحات السريعة
  const quickSuggestions = [
    "كفل لي لعبة 5×5 الليلة بمنطقتي",
    "منو أنشط لاعبين قربي الآن؟",
    "اقترح لي 3 مناطق مناسبة للحجز"
  ];

  return (
    <PhoneShell withNav>
      <StatusBar />
      
      {/* --- الهيدر الديناميكي باسم فزعة الاحترافي --- */}
      <header dir="rtl" className="flex items-center justify-between border-b border-border bg-background px-4 py-3 shadow-sm">
        <ThemeToggle />
        
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 border border-primary/30 text-primary shadow-sm">
            <Zap className="h-5 w-5" />
          </div>
          <div className="flex flex-col text-right">
            <h1 className="text-sm font-bold tracking-wide text-foreground flex items-center gap-1">
              فزعة <Sparkles className="h-3 w-3 text-primary" />
            </h1>
            <span className="text-[10px] text-muted-foreground font-medium">محادثة ودعم تنسيق المباريات</span>
          </div>
        </div>

        <div className="w-9" /> 
      </header>

      {/* --- منطقة الدردشة الديناميكية --- */}
      <div dir="rtl" className="flex-1 space-y-3.5 overflow-y-auto bg-background p-4 font-sans text-foreground">
        <RemoteState {...messagesState} empty={!messages.length}>
          <>
            {/* رسالة ترحيبية أولية */}
            <div className="flex flex-col items-start">
              <div className="flex max-w-[85%] items-end gap-2 flex-row-reverse">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface text-foreground border border-border text-xs">
                  ⚡
                </div>
                <div className="rounded-2xl rounded-bl-sm border border-border bg-surface px-4 py-3 text-xs leading-relaxed text-foreground shadow-sm">
                  هلا بيك 👋 آني خدمة فزعة. أكفل ربعك بسرعة: أجمع المنشطين بمنطقتك، أرتب اللعبة وأقترح الملعب والوقت. شتحب نسوي؟
                </div>
              </div>
              <span className="pl-9 pt-1 text-[10px] text-muted-foreground">الآن</span>
            </div>

            {messages.map((m, i) => {
              const isMine = m.mine || (userId && m.sender_id === userId);
              
              return (
                <div key={m.id || i} className={`group flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                  <div className={`flex max-w-[85%] items-end gap-2 ${isMine ? "flex-row" : "flex-row-reverse"}`}>
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface text-foreground border border-border text-xs">
                      {isMine ? <User className="h-3.5 w-3.5" /> : "⚡"}
                    </div>
                    <div 
                      className={`relative inline-block w-fit cursor-pointer rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-sm whitespace-pre-wrap break-words transition-all ${
                        isMine 
                          ? "rounded-br-sm bg-primary text-primary-foreground font-semibold" 
                          : "rounded-bl-sm border border-border bg-surface text-foreground"
                      } ${selectedMessageId === (m.id || i) ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`} 
                      onClick={() => setSelectedMessageId(selectedMessageId === (m.id || i) ? null : (m.id || i))}
                    >
                      <span>{m.text || m.body}</span>
                      {isMine && selectedMessageId === (m.id || i) && (
                        <button aria-label="حذف الرسالة" onClick={(e) => { e.stopPropagation(); handleDelete(m.id); setSelectedMessageId(null); }} className="absolute -left-9 top-1/2 -translate-y-1/2 rounded-full bg-surface p-1.5 shadow-sm border border-border">
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </button>
                      )}
                    </div>
                  </div>
                  <span className={`pt-1 text-[10px] text-muted-foreground ${isMine ? "pr-9" : "pl-9"}`}>{formatTime(m.created_at)}</span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        </RemoteState>
      </div>

      {/* --- شريط الاقتراحات السريعة الديناميكي --- */}
      <div dir="rtl" className="bg-background px-3 pt-2 pb-1 border-t border-border flex gap-2 overflow-x-auto no-scrollbar">
        {quickSuggestions.map((suggestion, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(suggestion)}
            className="shrink-0 rounded-full border border-border bg-surface px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
          >
            {suggestion}
          </button>
        ))}
      </div>

      {/* --- شريط الإرسال السفلي الديناميكي --- */}
      <div dir="rtl" className="flex items-center gap-2 bg-background p-3 border-t border-border">
        <div className="relative flex-1 flex items-center">
          <span className="absolute right-3 text-muted-foreground">
            <Zap className="h-4 w-4" />
          </span>
          <input 
            value={messageText} 
            onChange={e => setMessageText(e.target.value)} 
            onKeyDown={e => e.key === "Enter" && handleSend()} 
            placeholder="اكتب: كفل لي لعبة الليلة..." 
            className="w-full rounded-xl border border-border bg-surface pr-9 pl-4 py-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary" 
          />
        </div>
        <button 
          aria-label="إرسال الرسالة" 
          onClick={() => handleSend()} 
          disabled={sending || !messageText.trim()} 
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-transform active:scale-95 disabled:opacity-30 cursor-pointer shadow-sm"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </PhoneShell>
  );
}
