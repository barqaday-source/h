import { createFileRoute } from "@tanstack/react-router";
import { Plus, Send, Trash2, Users, Scale, Hand, Dumbbell, Flame, HeartPulse, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar, PhoneShell, StatusBar, ThemeToggle } from "@/components/ui-kit";
import { RemoteState, useRemoteData } from "@/hooks/use-app-data";
import { fetchCurrentMatchId, fetchMessages, sendMessage, uploadChatAttachment } from "@/lib/data";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export const Route = createFileRoute("/chat")({
  head: () => ({ meta: [{ title: "الدردشة الذكية | جوك" }] }),
  component: ChatScreen,
});

const GENERAL_MATCH_ID = "00000000-0000-0000-0000-000000000001";
const FAZAA_BOT_ID = "00000000-0000-0000-0000-0000000000FA";

// --- دوال الصوت والنغمات ---
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

function playRobotTone(type) {
  if (typeof window === "undefined") return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = type === "blink" ? 620 : 420;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.035, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.13);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(); oscillator.stop(context.currentTime + 0.14);
    oscillator.addEventListener("ended", () => context.close());
  } catch {}
}

// --- مكون روبوت "فزعة" للهيدر ---
function FazaaRobotHeader({ size = 52, gaze, mood = "idle", onClick }) {
  const lookX = Math.max(-3, Math.min(3, gaze.x * 0.08));
  const lookY = Math.max(-2, Math.min(2, gaze.y * 0.06));
  return (
    <div
      style={{ width: size, height: size }}
      className={`relative shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-[#00ff66] bg-[#1a1a1e] shadow-[0_0_16px_rgba(0,255,102,0.4)] transition-transform duration-200 hover:scale-105 active:scale-95 ${mood === "happy" ? "ring-4 ring-[#00ff66]/50" : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <img src="/assets/fazaa-robot-transparent.png" alt="فزعة" className="h-full w-full object-cover" style={{ transform: `translate(${lookX}px, ${lookY}px) scale(1.1)` }} onError={(e) => { e.target.src = "https://api.iconify.design/lucide:bot.svg?color=%2300ff66"; }} />
      {mood === "blink" && <>
        <span aria-hidden="true" className="pointer-events-none absolute rounded-full bg-[#20272b]" style={{ width: size * 0.22, height: size * 0.035, left: size * 0.29, top: size * 0.49, transform: "rotate(8deg)" }} />
        <span aria-hidden="true" className="pointer-events-none absolute rounded-full bg-[#20272b]" style={{ width: size * 0.22, height: size * 0.035, left: size * 0.55, top: size * 0.49, transform: "rotate(-8deg)" }} />
      </>}
      {mood === "typing" && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-[#00ff66] animate-ping" />}
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
    playRobotTone("click");
    setRobotMood("happy");
    setFazaaMenuOpen(v => !v);
    window.setTimeout(() => { playRobotTone("blink"); setRobotMood("blink"); }, 420);
    window.setTimeout(() => setRobotMood("idle"), 820);
  };

  const handleFazaaAction = async (type) => {
    if (!userId || userId === 'undefined') { toast.error("جاري تحميل الجلسة"); return; }
    setFazaaMenuOpen(false);
    setRobotMood("typing");
    try {
      let botText = "";
      if (type === 'quick') botText = "🤖 فزعة: دزيت فزعة سريعة لـ 3 لاعبين قريبين بالبصرة أونلاين.. ⏳";
      if (type === 'balance') botText = "🤖 فزعة: تم توازن الفرق بنجاح حسب المستويات والتقييمات.. ⚖️";
      if (type === 'keeper') botText = "🤖 فزعة: تم تنبيه الحراس المتاحين قرب ملعبكم.. 🧤";

      await sendMessage({ matchId, body: botText, senderId: FAZAA_BOT_ID });
      await messagesState.reload();
      playChatSound("send");
      toast.success("فزعة نفذت الطلب!");
    } catch (e) { toast.error(e.message); }
    finally { setTimeout(() => setRobotMood("idle"), 1500); }
  };

  const quickActions = [
    { icon: "💪", label: "جدول التضخيم", action: () => setMessageText("أريد جدول تمارين التضخيم المناسب 🏋️‍♂️") },
    { icon: "🥗", label: "دايت السعرات", action: () => setMessageText("اقترح لي دايت محسوب السعرات اليوم 🥗") },
    { icon: "⏱️", label: "كارديو سريع", action: () => setMessageText("أريد جدول تمارين كارديو سريعة ⏱️") },
    { icon: "📍", label: "وين اللعبة؟", action: () => setMessageText("وين اللعبة؟ دزوا لوكيشن الملعب 📍") },
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
      
      {/* --- رأس الشات الرياضي الفخم (#1a1a1e) --- */}
      <header dir="rtl" className="relative flex items-center justify-between border-b border-[#29292e] bg-[#1a1a1e] px-4 py-3 shadow-md">
        <ThemeToggle className="h-9 w-9 rounded-full border border-[#29292e] bg-[#202024] text-white" />
        
        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center">
            <FazaaRobotHeader size={48} gaze={gaze} mood={robotMood} onClick={handleRobotClick} />
          </div>
          <h1 className="mt-0.5 text-sm font-bold tracking-wide text-white">الكوتش وفزعة AI</h1>
          <span className="text-[10px] text-[#00ff66] flex items-center gap-1 font-medium">
            <span className="h-2 w-2 rounded-full bg-[#00ff66] animate-pulse"></span> أونلاين بالبصرة
          </span>
        </div>

        <button 
          onClick={() => toast.info("قريباً: تفاصيل حجز الملعب والفرق!")}
          aria-label="تفاصيل الحجز" 
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#29292e] bg-[#202024] text-slate-300 hover:text-[#00ff66] transition-colors"
        >
          <Users className="h-4 w-4" />
        </button>
      </header>

      {/* --- قائمة أوامر فزعة التفاعلية --- */}
      {fazaaMenuOpen && (
        <div dir="rtl" className="animate-in slide-in-from-top-2 border-b border-[#29292e] bg-[#16161a] px-4 py-3 shadow-2xl">
          <p className="pb-2 text-center text-xs font-bold text-[#00ff66]">⚡ شبيك لبيك، أوامر فزعة الكوتش:</p>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => handleFazaaAction('quick')} className="flex flex-col items-center gap-1 rounded-xl bg-[#202024] border border-[#ff4500]/40 p-2.5 text-xs font-bold text-white hover:bg-[#ff4500] transition-colors"><Users className="h-4 w-4 text-[#ff4500]" /> فزعة سريعة</button>
            <button onClick={() => handleFazaaAction('balance')} className="flex flex-col items-center gap-1 rounded-xl bg-[#202024] border border-[#00ff66]/40 p-2.5 text-xs font-bold text-white hover:bg-[#00ff66] hover:text-black transition-colors"><Scale className="h-4 w-4 text-[#00ff66]" /> وازن الفرق</button>
            <button onClick={() => handleFazaaAction('keeper')} className="flex flex-col items-center gap-1 rounded-xl bg-[#202024] border border-slate-600 p-2.5 text-xs font-bold text-white hover:bg-slate-700 transition-colors"><Hand className="h-4 w-4 text-amber-400" /> جيب حارس</button>
          </div>
        </div>
      )}

      {/* --- أزرار الاقتراحات السريعة الرياضية --- */}
      <div dir="rtl" className="bg-[#121214] px-3 py-2.5 border-b border-[#29292e]/40">
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
          {quickActions.map((c) => (
            <button key={c.label} onClick={c.action} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#29292e] bg-[#202024] px-3.5 py-1.5 text-xs font-medium text-slate-200 transition-all hover:border-[#ff4500] hover:text-[#ff4500]">
              <span>{c.icon}</span>{c.label}
            </button>
          ))}
        </div>
      </div>

      {/* --- منطقة الرسائل بخلفية السوداء الفخمة (#121214) --- */}
      <div dir="rtl" className="flex-1 space-y-3.5 overflow-y-auto bg-[#121214] p-4 font-sans text-white">
        <RemoteState {...messagesState} empty={!messages.length}>
          <>
            {/* كارت تترحيب تكتيكي افتراضي */}
            <div className="w-[85%] overflow-hidden rounded-2xl border border-[#ff4500] bg-[#202024] shadow-lg mb-2">
              <div className="bg-[#ff4500] px-4 py-1.5 text-xs font-bold text-white flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> تمرين مقترح لك اليوم 🏋️‍♂️
              </div>
              <div className="p-4">
                <h5 className="mb-1 text-sm font-bold text-white">تمارين الجزء العلوي (Chest & Triceps)</h5>
                <p className="m-0 text-xs text-[#a1a1aa]">المحتوى: 4 جولات × 12 تكرار</p>
                <button onClick={() => toast.success("تم فتح تفاصيل التمارين الرياضية!")} className="mt-3 w-full rounded-xl bg-white py-2 text-xs font-bold text-black transition-colors hover:bg-slate-200 cursor-pointer">
                  عرض حركات التمرين
                </button>
              </div>
            </div>

            {messages.map((m, i) => {
              const isMine = m.mine;
              const isFazaa = m.sender_id === FAZAA_BOT_ID || m.author === 'فزعة' || m.text?.startsWith('🤖');
              return (
                <div key={m.id || i} className={`group flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                  <div className={`flex max-w-full items-end gap-2 ${isMine ? "flex-row" : "flex-row-reverse"}`}>
                    {!isMine && <Avatar name={isFazaa ? "فزعة" : m.author || "لاعب"} size="h-8 w-8" />}
                    <div 
                      className={`relative inline-block w-fit max-w-[80%] cursor-pointer rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-lg whitespace-pre-wrap break-words transition-all ${
                        isFazaa 
                          ? "rounded-bl-sm bg-[#1a1a1e] border-2 border-[#00ff66] text-white shadow-[0_0_15px_rgba(0,255,102,0.15)]" 
                          : isMine 
                            ? "rounded-br-sm bg-[#ff4500] text-white font-medium" 
                            : "rounded-bl-sm border border-[#29292e] bg-[#202024] text-slate-200"
                      } ${selectedMessageId === (m.id || i) ? "ring-2 ring-[#00ff66] ring-offset-2 ring-offset-[#121214]" : ""}`} 
                      onClick={() => setSelectedMessageId(selectedMessageId === (m.id || i) ? null : (m.id || i))}
                    >
                      {m.attachmentUrl && m.messageType === "image" && <img src={m.attachmentUrl} className="mb-2.5 max-h-60 w-fit rounded-xl object-cover" alt="" />}
                      {m.attachmentUrl && m.messageType === "audio" && <audio controls src={m.attachmentUrl} className="mb-1 w-full rounded-full" />}
                      <span>{m.text || m.body}</span>
                      {isMine && selectedMessageId === (m.id || i) && (
                        <button aria-label="حذف الرسالة" onClick={(e) => { e.stopPropagation(); handleDelete(m.id); setSelectedMessageId(null); }} className="absolute -left-10 top-1/2 -translate-y-1/2 rounded-full bg-[#202024] p-2 shadow-md border border-[#29292e]">
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </button>
                      )}
                    </div>
                  </div>
                  <span className={`pt-1 text-[10px] text-[#a1a1aa] ${isMine ? "pr-2" : "pl-10"}`}>{formatTime(m.created_at)}</span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        </RemoteState>
      </div>

      {/* --- شريط الإرسال السفلي الرياضي (#1a1a1e) --- */}
      <div dir="rtl" className="flex items-center gap-2 border-t border-[#29292e] bg-[#1a1a1e] p-3">
        <input id="att" type="file" className="hidden" onChange={handleAttachment} />
        <button aria-label="إضافة مرفق" onClick={() => document.getElementById("att")?.click()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#202024] border border-[#29292e] text-[#00ff66] transition-colors hover:bg-[#29292e]">
          <Plus className="h-5 w-5" />
        </button>
        <input 
          value={messageText} 
          onChange={e => { setMessageText(e.target.value); setRobotMood(e.target.value.trim() ? "typing" : "idle"); }} 
          onKeyDown={e => e.key === "Enter" && handleSend()} 
          placeholder="اسأل الكوتش أو اكتب للربع..." 
          className="flex-1 rounded-xl border border-[#29292e] bg-[#202024] px-3.5 py-2.5 text-xs text-white outline-none placeholder:text-[#a1a1aa] focus:border-[#ff4500]" 
        />
        <button 
          aria-label="إرسال الرسالة" 
          onClick={handleSend} 
          disabled={sending || !messageText.trim()} 
          className="flex h-10 items-center justify-center rounded-xl bg-[#ff4500] px-4 text-xs font-bold text-white transition-opacity disabled:opacity-30 cursor-pointer"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </PhoneShell>
  );
}
