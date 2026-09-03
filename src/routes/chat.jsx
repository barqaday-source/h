import { createFileRoute } from "@tanstack/react-router";
import { Phone, Plus, Send, Trash2, Users, Scale, Hand } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar, PhoneShell, StatusBar, ThemeToggle } from "@/components/ui-kit";
import { RemoteState, useRemoteData } from "@/hooks/use-app-data";
import { fetchCurrentMatchId, fetchMessages, sendMessage, uploadChatAttachment } from "@/lib/data";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export const Route = createFileRoute("/chat")({
  head: () => ({ meta: [{ title: "الدردشة | جوك" }] }),
  component: ChatScreen,
});

const GENERAL_MATCH_ID = "00000000-0000-0000-0000-000000000001";
const FAZAA_BOT_ID = "00000000-0000-0000-0000-0000000000FA";

function playChatSound(type) {
  if (typeof window === "undefined") return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const isDelete = type === "delete";
    oscillator.type = isDelete ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(isDelete ? 260 : 520, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(isDelete ? 150 : 760, context.currentTime + 0.12);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.055, context.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.16);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(); oscillator.stop(context.currentTime + 0.17);
    oscillator.addEventListener("ended", () => context.close());
  } catch {}
}

function FazaaRobotHeader({ size = 52, gaze, mood = "idle", onClick }) {
  const lookX = Math.max(-3, Math.min(3, gaze.x * 0.08));
  const lookY = Math.max(-2, Math.min(2, gaze.y * 0.06));
  return (
    <div
      style={{ width: size, height: size }}
      className={`relative shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-emerald-500 bg-slate-900 shadow-[0_0_16px_rgba(16,185,129,0.4)] transition-transform duration-200 hover:scale-105 active:scale-95 ${mood === "happy" ? "ring-4 ring-emerald-400/50" : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <img src="/assets/fazaa-robot-transparent.png" alt="فزعة" className="h-full w-full object-cover" style={{ transform: `translate(${lookX}px, ${lookY}px) scale(1.1)` }} />
      {mood === "typing" && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-400 animate-ping" />}
    </div>
  );
}

function formatTime(iso) {
  if (!iso) return "الآن";
  try { return new Date(iso).toLocaleTimeString("ar-IQ", { hour: "numeric", minute: "2-digit", hour12: true }); } catch { return "الآن"; }
}

function ChatScreen() {
  const [matchId, setMatchId] = useState(GENERAL_MATCH_ID);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const [userId, setUserId] = useState(null);
  const [selectedMessageId, setSelectedMessageId] = useState(null);
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  const [robotMood, setRobotMood] = useState("idle");
  const [fazaaMenuOpen, setFazaaMenuOpen] = useState(false);

  useEffect(() => {
    const handlePointerMove = (event) => { setGaze({ x: event.clientX - window.innerWidth / 2, y: event.clientY - 92 }); };
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, []);

  const handleRobotClick = () => {
    setRobotMood("happy");
    setFazaaMenuOpen(v => !v);
    setTimeout(() => setRobotMood("idle"), 800);
  };

  const handleFazaaAction = async (type) => {
    if (!userId || userId === 'undefined') { toast.error("جاري تحميل الجلسة"); return; }
    setFazaaMenuOpen(false);
    setRobotMood("typing");
    try {
      let botText = "";
      if (type === 'quick') botText = "🤖 فزعة: دزيت فزعة سريعة! جاي أدور لاعبين قريبين من البصرة أونلاين.. ⏳";
      if (type === 'balance') botText = "🤖 فزعة: تمام، جاي أوازن الفرق حسب المستويات.. ⚖️";
      if (type === 'keeper') botText = "🤖 فزعة: أدورلك حارس مرتب قريب.. 🧤";

      await sendMessage({ matchId, body: botText, senderId: FAZAA_BOT_ID });
      await messagesState.reload();
      playChatSound("send");
      toast.success("فزعة انطلقت!");
    } catch (e) { toast.error(e.message); }
    finally { setTimeout(() => setRobotMood("idle"), 1500); }
  };

  const quickActions = [
    { icon: "⚽", label: "فزعة", action: () => handleFazaaAction('quick'), full: "يا ولد ناقصنا لاعبين، فزعة للربع! ⚽" },
    { icon: "👥", label: "تجميعة", action: () => setMessageText("منو جاهز ينزل معنا اليوم بالملعب؟ 🔥"), full: "منو جاهز ينزل معنا اليوم بالملعب؟ 🔥" },
    { icon: "🧤", label: "حارس", action: () => handleFazaaAction('keeper'), full: "محتاجين حارس مرتب؟ 🧤" },
    { icon: "📍", label: "المكان", action: () => setMessageText("وين اللعبة؟ دزوا لوكيشن 📍"), full: "وين اللعبة؟ دزوا لوكيشن 📍" },
  ];

  const messagesState = useRemoteData(() => {
    if (!matchId || matchId === 'undefined') return Promise.resolve([]);
    return fetchMessages(matchId);
  }, [matchId]);
  const messages = messagesState.data ?? [];

  useEffect(() => {
    supabase?.auth.getSession().then(({ data }) => { const id = data?.session?.user?.id; if (id && id !== 'undefined') setUserId(id); });
    fetchCurrentMatchId().then(id => { if (id && id !== 'undefined') setMatchId(id); }).catch(() => {});
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  const reloadRef = useRef(messagesState.reload);
  useEffect(() => { reloadRef.current = messagesState.reload; });
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !matchId || matchId === 'undefined') return;
    const ch = supabase.channel(`messages:${matchId}`).on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` }, () => reloadRef.current?.()).subscribe();
    return () => supabase.removeChannel(ch);
  }, [matchId]);

  const handleSend = async () => {
    const body = messageText.trim(); if (!body) return;
    if (!userId || userId === 'undefined') { toast.error("جاري تحميل الجلسة"); return; }
    setSending(true);
    try { await sendMessage({ matchId, body }); playChatSound("send"); setMessageText(""); await messagesState.reload(); } catch (e) { toast.error(e.message); } finally { setSending(false); }
  };

  const handleAttachment = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setSending(true);
    try { const att = await uploadChatAttachment(file); await sendMessage({ matchId, body: file.name, attachment: att }); playChatSound("send"); await messagesState.reload(); } catch (err) { toast.error(err.message); } finally { setSending(false); e.target.value = ""; }
  };

  const handleDelete = async (msgId) => {
    if (!msgId) return;
    try { await supabase.from('messages').delete().eq('id', msgId); playChatSound("delete"); await messagesState.reload(); } catch { toast.error("ما انحذفت"); }
  };

  return (
    <PhoneShell withNav>
      <StatusBar />
      
      {/* هيدر احترافي بضمير فزعة */}
      <header dir="rtl" className="flex items-center justify-between border-b border-emerald-100 bg-white/90 px-4 py-3 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90 shadow-sm">
        <div className="flex items-center gap-3">
          <FazaaRobotHeader size={46} gaze={gaze} mood={robotMood} onClick={handleRobotClick} />
          <div className="text-right">
            <h1 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
              فزعة <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </h1>
            <p className="text-xs text-emerald-600 font-bold">المساعد الذكي • متصل الآن</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button aria-label="اتصال" className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-slate-800 dark:text-emerald-400 transition-colors">
            <Phone className="h-4 w-4" />
          </button>
          <ThemeToggle className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-800" />
        </div>
      </header>

      {/* قائمة أوامر فزعة التفاعلية */}
      {fazaaMenuOpen && (
        <div dir="rtl" className="animate-in slide-in-from-top-2 border-b border-emerald-100 bg-emerald-50/80 px-4 py-3 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
          <p className="pb-2 text-center text-xs font-bold text-emerald-800 dark:text-emerald-300">⚡ شبيك لبيك، فزعة بين إيديك:</p>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => handleFazaaAction('quick')} className="flex flex-col items-center gap-1 rounded-xl bg-white border border-emerald-200 p-2 text-xs font-bold text-emerald-700 shadow-sm hover:bg-emerald-500 hover:text-white transition-all"><Users className="h-4 w-4" /> فزعة سريعة</button>
            <button onClick={() => handleFazaaAction('balance')} className="flex flex-col items-center gap-1 rounded-xl bg-white border border-slate-200 p-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-900 hover:text-white transition-all"><Scale className="h-4 w-4" /> وازن الفرق</button>
            <button onClick={() => handleFazaaAction('keeper')} className="flex flex-col items-center gap-1 rounded-xl bg-white border border-slate-200 p-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-900 hover:text-white transition-all"><Hand className="h-4 w-4" /> حارس مرتب</button>
          </div>
        </div>
      )}

      {/* شريط الاقتراحات السريعة */}
      {messageText.length === 0 && !fazaaMenuOpen && (
        <div dir="rtl" className="border-b border-slate-100 bg-white/60 px-3 py-2.5 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex gap-2 overflow-x-auto no-scrollbar justify-center">
            {quickActions.map((c) => (
              <button key={c.label} onClick={c.action} className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-emerald-100 bg-emerald-50/50 px-3.5 py-1.5 text-xs font-bold text-emerald-700 transition-all hover:bg-emerald-500 hover:text-white dark:border-slate-700 dark:bg-slate-800 dark:text-emerald-300">
                <span className="ml-1">{c.icon}</span>{c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* منطقة الرسائل الحديثة والنظيفة */}
      <div dir="rtl" className="flex-1 space-y-3 overflow-y-auto bg-[#f8fafc] px-4 py-4 dark:bg-[#0b1215]">
        <RemoteState {...messagesState} empty={!messages.length}>
          <>
            {messages.map((m, i) => {
              const isMine = m.mine;
              const isFazaa = m.sender_id === FAZAA_BOT_ID || m.author === 'فزعة' || m.text?.startsWith('🤖');
              return (
                <div key={m.id || i} className={`group flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                  <div className={`flex max-w-full items-end gap-2 ${isMine ? "flex-row" : "flex-row-reverse"}`}>
                    {!isMine && <Avatar name={isFazaa ? "فزعة" : m.author || "لاعب"} size="h-7 w-7" />}
                    <div 
                      className={`relative inline-block w-fit max-w-[78%] cursor-pointer rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-sm transition-all whitespace-pre-wrap break-words ${
                        isFazaa 
                          ? "rounded-bl-sm bg-slate-900 border-2 border-emerald-500 text-white shadow-[0_4px_16px_rgba(16,185,129,0.2)]" 
                          : isMine 
                            ? "rounded-br-sm bg-emerald-500 text-white font-medium" 
                            : "rounded-bl-sm border border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      } ${selectedMessageId === (m.id || i) ? "ring-2 ring-emerald-400 ring-offset-2" : ""}`} 
                      onClick={() => setSelectedMessageId(selectedMessageId === (m.id || i) ? null : (m.id || i))}
                    >
                      {m.attachmentUrl && m.messageType === "image" && <img src={m.attachmentUrl} className="mb-2 max-h-48 w-full rounded-xl object-cover" alt="" />}
                      {m.attachmentUrl && m.messageType === "audio" && <audio controls src={m.attachmentUrl} className="mb-1 w-full rounded-full" />}
                      <span>{m.text || m.body}</span>
                      {isMine && selectedMessageId === (m.id || i) && (
                        <button aria-label="حذف الرسالة" onClick={(e) => { e.stopPropagation(); handleDelete(m.id); setSelectedMessageId(null); }} className="absolute -left-9 top-1/2 -translate-y-1/2 rounded-full bg-white p-1.5 shadow-md dark:bg-slate-700">
                          <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                        </button>
                      )}
                    </div>
                  </div>
                  <span className={`pt-1 text-[10px] text-slate-400 ${isMine ? "pr-1" : "pl-9"}`}>{formatTime(m.created_at)}</span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        </RemoteState>
      </div>

      {/* شريط الإرسال السفلي */}
      <div dir="rtl" className="flex items-center gap-2 border-t border-emerald-100 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-1 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800">
          <input value={messageText} onChange={e => { setMessageText(e.target.value); setRobotMood(e.target.value.trim() ? "typing" : "idle"); }} onKeyDown={e => e.key === "Enter" && handleSend()} placeholder="اكتب رسالتك للربع.." className="w-full bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400 dark:text-white" />
          <button aria-label="إرسال" onClick={handleSend} disabled={sending || !messageText.trim()} className="text-emerald-600 transition-opacity disabled:opacity-30">
            <Send className="h-4 w-4" />
          </button>
        </div>
        <input id="att" type="file" className="hidden" onChange={handleAttachment} />
        <button aria-label="مرفق" onClick={() => document.getElementById("att")?.click()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 shadow-sm transition-colors hover:bg-emerald-500 hover:text-white dark:bg-slate-800 dark:text-emerald-400">
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </PhoneShell>
  );
}
