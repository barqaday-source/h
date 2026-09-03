import { createFileRoute } from "@tanstack/react-router";
import { Plus, Send, Trash2, Users, Scale, Hand } from "lucide-react";
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

// --- مكون روبوت "فزعة" الجديد للهيدر ---
function FazaaRobotHeader({ size = 52, gaze, mood = "idle", onClick }) {
  // تأثير النظر والحركة مع الماوس
  const lookX = Math.max(-3, Math.min(3, gaze.x * 0.08));
  const lookY = Math.max(-2, Math.min(2, gaze.y * 0.06));
  return (
    <div
      style={{ width: size, height: size }}
      className={`relative shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-emerald-500 bg-slate-900 shadow-[0_0_16px_rgba(16,185,129,0.4)] transition-transform duration-200 hover:scale-105 active:scale-95 ${mood === "happy" ? "ring-4 ring-emerald-400/50" : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onClick?.(); }}
    >
      {/* تأكد من وجود مسار الصورة الصحيح في مشروعك */}
      <img src="/assets/fazaa-robot-transparent.png" alt="فزعة" className="h-full w-full object-cover" style={{ transform: `translate(${lookX}px, ${lookY}px) scale(1.1)` }} />
      {mood === "blink" && <>
        <span aria-hidden="true" className="pointer-events-none absolute rounded-full bg-[#20272b]" style={{ width: size * 0.22, height: size * 0.035, left: size * 0.29, top: size * 0.49, transform: "rotate(8deg)" }} />
        <span aria-hidden="true" className="pointer-events-none absolute rounded-full bg-[#20272b]" style={{ width: size * 0.22, height: size * 0.035, left: size * 0.55, top: size * 0.49, transform: "rotate(-8deg)" }} />
      </>}
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

  // --- تأثير تتبع حركة المؤشر ---
  useEffect(() => {
    const handlePointerMove = (event) => { setGaze({ x: event.clientX - window.innerWidth / 2, y: event.clientY - 92 }); };
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, []);

  // --- التعامل مع ضغطة الروبوت ---
  const handleRobotClick = () => {
    playRobotTone("click");
    setRobotMood("happy");
    setFazaaMenuOpen(v => !v);
    window.setTimeout(() => { playRobotTone("blink"); setRobotMood("blink"); }, 420);
    window.setTimeout(() => setRobotMood("idle"), 820);
  };

  // --- تنفيذ أوامر فزعة ---
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

  // --- أزرار الاقتراحات السريعة ---
  const quickActions = [
    { icon: "⚽", label: "فزعة", action: () => handleFazaaAction('quick'), full: "يا ولد ناقصنا لاعبين، فزعة للربع! ⚽" },
    { icon: "👥", label: "تجميعة", action: () => setMessageText("منو جاهز ينزل معنا اليوم بالملعب؟ 🔥"), full: "منو جاهز ينزل معنا اليوم بالملعب؟ 🔥" },
    { icon: "🧤", label: "حارس", action: () => handleFazaaAction('keeper'), full: "محتاجين حارس مرتب؟ 🧤" },
    { icon: "📍", label: "المكان", action: () => setMessageText("وين اللعبة؟ دزوا لوكيشن 📍"), full: "وين اللعبة؟ دزوا لوكيشن 📍" },
  ];

  // --- جلب الرسائل من Supabase ---
  const messagesState = useRemoteData(() => {
    if (!matchId || matchId === 'undefined') return Promise.resolve([]);
    return fetchMessages(matchId);
  }, [matchId]);
  const messages = messagesState.data ?? [];

  // --- تهيئة الجلسة والمستمعين ---
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

  // --- دوال إرسال وحذف الرسائل ---
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
      
      {/* --- الهيدر الاحترافي الجديد بهوية خضراء وفزعة --- */}
      <header dir="rtl" className="relative flex min-h-[60px] items-center justify-between border-b border-emerald-100 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {/* زر تبديل الوضع (نهاري/ليلي) */}
        <ThemeToggle className="h-10 w-10 rounded-full border border-slate-200 bg-slate-50 shadow-sm dark:border-slate-700 dark:bg-slate-800" />
        
        {/* فزعة في المنتصف */}
        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center">
          <div className="flex h-14 w-14 items-center justify-center">
            <FazaaRobotHeader size={54} gaze={gaze} mood={robotMood} onClick={handleRobotClick} />
          </div>
          <h1 className="mt-1 text-base font-extrabold tracking-wide text-slate-900 dark:text-white">فزعة</h1>
          <span className="text-[11px] font-medium text-[#39ff88]">دردشة الربع</span>
        </div>

        {/* زر تفاصيل المباراة السريع (بدل زر الاتصال) */}
        <button 
          onClick={() => toast.info("قريباً: عرض تفاصيل الحجز وملعب المباراة!")}
          aria-label="تفاصيل المباراة" 
          className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 shadow-sm transition-colors hover:border-[#39ff88] hover:bg-emerald-950/40 hover:text-[#39ff88] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          title="تفاصيل الحجز والمباراة"
        >
          <Users className="h-4 w-4" />
        </button>
      </header>

      {/* --- قائمة أوامر فزعة التفاعلية (Glassmorphism) --- */}
      {fazaaMenuOpen && (
        <div dir="rtl" className="animate-in slide-in-from-top-2 border-b border-emerald-100 bg-white px-3 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.08)] dark:border-slate-800 dark:bg-slate-900">
          <p className="pb-2 text-center text- font-bold text-slate-500">⚡ شبيك لبيك، فزعة بين إيديك:</p>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => handleFazaaAction('quick')} className="flex flex-col items-center gap-1 rounded- bg-emerald-50 border border-emerald-200 p-3 text- font-bold text-emerald-700 hover:bg-emerald-500 hover:text-white transition-colors"><Users className="h-5 w-5" /> فزعة سريعة</button>
            <button onClick={() => handleFazaaAction('balance')} className="flex flex-col items-center gap-1 rounded- bg-slate-50 border border-slate-200 p-3 text- font-bold text-slate-700 hover:bg-slate-
