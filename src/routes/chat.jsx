import { createFileRoute } from "@tanstack/react-router";
import { Info, Plus, Send, Trash2, Users, Scale, Hand } from "lucide-react";
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
    oscillator.type = isDelete? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(isDelete? 260 : 520, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(isDelete? 150 : 760, context.currentTime + 0.12);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.055, context.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.16);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.17);
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
    oscillator.frequency.value = type === "blink"? 620 : 420;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.035, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.13);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.14);
    oscillator.addEventListener("ended", () => context.close());
  } catch {}
}

function FazaaRobotNew({ size = 56, gaze, mood = "idle", onClick }) {
  const lookX = Math.max(-4, Math.min(4, gaze.x * 0.1));
  const lookY = Math.max(-3, Math.min(3, gaze.y * 0.08));
  return (
    <div
      style={{ width: size, height: size }}
      className={`relative shrink-0 cursor-pointer overflow-hidden rounded-full transition-transform duration-150 active:scale-95 ${mood === "happy"? "scale-110 drop-shadow-[0_0_12px_rgba(57,255,136,0.7)]" : ""}`}
      aria-label="روبوت فزعة"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onClick?.(); }}
    >
      <img
        src="/assets/fazaa-robot-transparent.png"
        alt="روبوت فزعة"
        className="h-full w-full object-cover transition-transform duration-150"
        style={{ transform: `translate(${lookX}px, ${lookY}px) scale(1.03)` }}
      />
      {mood === "blink" && <>
        <span aria-hidden="true" className="pointer-events-none absolute rounded-full bg-[#20272b]" style={{ width: size * 0.22, height: size * 0.035, left: size * 0.29, top: size * 0.49, transform: "rotate(8deg)" }} />
        <span aria-hidden="true" className="pointer-events-none absolute rounded-full bg-[#20272b]" style={{ width: size * 0.22, height: size * 0.035, left: size * 0.55, top: size * 0.49, transform: "rotate(-8deg)" }} />
      </>}
      {mood === "happy" && <span aria-hidden="true" className="pointer-events-none absolute bottom-[18%] left-1/2 h- w-[22%] -translate-x-1/2 rounded-full bg-[#39ff88] shadow-[0_0_5px_#39ff88]" />}
      {mood === "typing" && <span aria-hidden="true" className="pointer-events-none absolute right-[8%] top-[8%] rounded-full bg-[#39ff88] px-1.5 py-0.5 text- font-black text-[#032015] shadow-[0_0_8px_#39ff88]">...</span>}
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
  const [showMatchInfo, setShowMatchInfo] = useState(false);

  useEffect(() => {
    const handlePointerMove = (event) => { setGaze({ x: event.clientX - window.innerWidth / 2, y: event.clientY - 92 }); };
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, []);

  const handleRobotClick = () => {
    playRobotTone("click");
    setRobotMood("happy");
    setFazaaMenuOpen((v) =>!v);
    window.setTimeout(() => { playRobotTone("blink"); setRobotMood("blink"); }, 420);
    window.setTimeout(() => setRobotMood("idle"), 820);
  };

  const handleFazaaAction = async (type) => {
    if (!userId || userId === "undefined") { toast.error("جاري تحميل الجلسة"); return; }
    setFazaaMenuOpen(false);
    setRobotMood("typing");
    try {
      let botText = "";
      if (type === "quick") botText = "🤖 فزعة: دزيت فزعة سريعة! جاي أدور 3 لاعبين قريبين من البصرة أونلاين.. ⏳";
      if (type === "balance") botText = "🤖 فزعة: تمام، جاي أوازن الفرق حسب المستويات.. ⚖️";
      if (type === "keeper") botText = "🤖 فزعة: أدورلك حارس مرتب قريب.. 🧤";
      await sendMessage({ matchId, body: botText, senderId: FAZAA_BOT_ID });
      await messagesState.reload();
      playChatSound("send");
      toast.success("فزعة انطلقت!");
    } catch (e) { toast.error(e.message); } finally { setTimeout(() => setRobotMood("idle"), 1500); }
  };

  const quickActions = [
    { icon: "⚽", label: "فزعة", action: () => handleFazaaAction("quick") },
    { icon: "👥", label: "تجميعة", action: () => setMessageText("منو جاهز ينزل معنا اليوم بالملعب؟ 🔥") },
    { icon: "🧤", label: "حارس", action: () => handleFazaaAction("keeper") },
    { icon: "📍", label: "المكان", action: () => setMessageText("وين اللعبة؟ دزوا لوكيشن 📍") },
  ];

  const messagesState = useRemoteData(() => {
    if (!matchId || matchId === "undefined") return Promise.resolve([]);
    return fetchMessages(matchId);
  }, [matchId]);
  const messages = messagesState.data?? [];

  useEffect(() => {
    supabase?.auth.getSession().then(({ data }) => {
      const id = data?.session?.user?.id;
      if (id && id!== "undefined" && id!== "null") setUserId(id);
    });
    fetchCurrentMatchId().then((id) => { if (id && id!== "undefined") setMatchId(id); }).catch(() => {});
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const reloadRef = useRef(messagesState.reload);
  useEffect(() => { reloadRef.current = messagesState.reload; });
  useEffect(() => {
    if (!isSupabaseConfigured ||!supabase ||!matchId || matchId === "undefined") return;
    const ch = supabase.channel(`messages:${matchId}`).on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` }, () => reloadRef.current?.()).subscribe();
    return () => supabase.removeChannel(ch);
  }, [matchId]);

  const handleSend = async () => {
    const body = messageText.trim(); if (!body) return;
    if (!userId || userId === "undefined" || userId === "null") { toast.error("جاري تحميل الجلسة"); return; }
    if (!matchId || matchId === "undefined") return;
    setSending(true);
    try { await sendMessage({ matchId, body }); playChatSound("send"); setMessageText(""); await messagesState.reload(); } catch (e) { toast.error(e.message); } finally { setSending(false); }
  };

  const handleAttachment = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!userId || userId === "undefined") { toast.error("انتظر تحميل الجلسة"); return; }
    setSending(true);
    try { const att = await uploadChatAttachment(file); await sendMessage({ matchId, body: file.name, attachment: att }); playChatSound("send"); await messagesState.reload(); } catch (err) { toast.error(err.message); } finally { setSending(false); e.target.value = ""; }
  };

  const handleDelete = async (msgId) => {
    if (!msgId || msgId === "undefined") return;
    try { await supabase.from("messages").delete().eq("id", msgId); playChatSound("delete"); await messagesState.reload(); } catch { toast.error("ما انحذفت"); }
  };

  return (
    <PhoneShell withNav>
      <StatusBar />
      <header dir="rtl" className="relative flex min-h- items-center justify-between border-b border-slate-100 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <ThemeToggle className="h-10 w-10 rounded-full border border-slate-200 bg-slate-50 shadow-sm dark:border-slate-700 dark:bg-slate-800" />
        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center">
          <div className="flex h-14 w-14 items-center justify-center">
            <FazaaRobotNew size={54} gaze={gaze} mood={robotMood} onClick={handleRobotClick} />
          </div>
          <h1 className="mt-1 text-base font-extrabold tracking-wide text-slate-900 dark:text-white">فزعة</h1>
          <span className="text- font-medium text-[#39ff88]">دردشة الربع</span>
        </div>
        <button onClick={() => setShowMatchInfo((v) =>!v)} aria-label="تفاصيل المباراة" className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 shadow-sm transition-colors hover:border-[#39ff88] hover:bg-emerald-950/40 hover:text-[#39ff88] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300" title="تفاصيل الحجز والمباراة">
          <Info className="h-4 w-4" />
        </button>
      </header>

      {showMatchInfo && (
        <div dir="rtl" className="border-b border-emerald-100 bg-emerald-50/80 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-[#0a1f16]">
          <div className="flex items-center justify-between">
            <div><p className="text- font-bold text-emerald-700 dark:text-emerald-300">المباراة الحالية</p><p className="text- font-extrabold text-slate-900 dark:text-white">ملعب الجمهورية - البصرة</p><p className="text- text-slate-500 dark:text-slate-400">اليوم 8:00 مساءً - 5 ضد 5</p></div>
            <div className="text-left"><span className="rounded-full bg-emerald-500 text-white text- font-bold px-2.5 py-1">مفتوحة</span><p className="text- text-slate-500 dark:text-slate-400 mt-1">ID: {matchId.slice(0,8)}..</p></div>
          </div>
        </div>
      )}

      {fazaaMenuOpen && (
        <div dir="rtl" className="border-b border-emerald-100 bg-white px-3 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.08)] dark:border-slate-800 dark:bg-slate-900">
          <p className="pb-2 text-center text- font-bold text-slate-500">أوامر فزعة الذكي 🤖</p>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => handleFazaaAction("quick")} className="flex flex-col items-center gap-1 rounded- bg-emerald-50 border border-emerald-200 p-3 text- font-bold text-emerald-700 hover:bg-emerald-500 hover:text-white transition-colors"><Users className="h-5 w-5" /> فزعة سريعة</button>
            <button onClick={() => handleFazaaAction("balance")} className="flex flex-col items-center gap-1 rounded- bg-slate-50 border border-slate-200 p-3 text- font-bold text-slate-700 hover:bg-slate-900 hover:text-white transition-colors"><Scale className="h-5 w-5" /> وازن الفرق</button>
            <button onClick={() => handleFazaaAction("keeper")} className="flex flex-col items-center gap-1 rounded- bg-slate-50 border border-slate-200 p-3 text- font-bold text-slate-700 hover:bg-slate-900 hover:text-white transition-colors"><Hand className="h-5 w-5" /> جيب حارس</button>
          </div>
        </div>
      )}

      {messageText.length === 0 &&!fazaaMenuOpen &&!showMatchInfo && (
        <div dir="rtl" className="border-b border-slate-100 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex gap-2 overflow-x-auto no-scrollbar justify-center">
            {quickActions.map((c) => (
              <button key={c.label} onClick={c.action} className="inline-flex w-fit shrink-0 items-center whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700 transition-all hover:border-[#39ff88] hover:bg-[#39ff88] hover:text-[#032015] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <span className="ml-1.5">{c.icon}</span>{c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div dir="rtl" className="flex-1 space-y-3 overflow-y-auto bg-[#f8fafc] px-4 py-4 dark:bg-[#041c14]">
        <RemoteState {...messagesState} empty={!messages.length}>
          <>
            {messages.map((m, i) => {
              const isMine = m.mine;
              const isFazaa = m.sender_id === FAZAA_BOT_ID || m.text?.startsWith("🤖");
              return (
                <div key={m.id || i} className={`group flex flex-col ${isMine? "items-end" : "items-start"}`}>
                  <div className={`flex max-w-full items-end gap-2 ${isMine? "flex-row" : "flex-row-reverse"}`}>
                    {!isMine && <Avatar name={isFazaa? "فزعة" : m.author || "لاعب"} size="h-8 w-8" />}
                    <div
                      className={`relative inline-block w-fit max-w-[78%] cursor-pointer rounded- px-4 py-3 text-sm leading-relaxed shadow-[0_2px_8px_rgba(0,0,0,0.06)] whitespace-pre-wrap break-words transition-shadow ${isFazaa? "rounded-bl- bg-[#0f172a] border-2 border-[#39ff88] text-white" : isMine? "rounded-br- bg-[#00d978] text-[#032015]" : "rounded-bl- border border-slate-100 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"} ${selectedMessageId === (m.id || i)? "ring-2 ring-[#39ff88] ring-offset-2 ring-offset-[#041c14]" : ""}`}
                      onClick={() => setSelectedMessageId(selectedMessageId === (m.id || i)? null : (m.id || i))}
                      style={{ overflowWrap: "anywhere" }}
                    >
                      {m.attachmentUrl && m.messageType === "image" && <img src={m.attachmentUrl} className="mb-2.5 max-h-60 w-fit rounded- object-cover" alt="" />}
                      {m.attachmentUrl && m.messageType === "audio" && <audio controls src={m.attachmentUrl} className="mb-1 w-full rounded-full" />}
                      <span>{m.text || m.body}</span>
                      {isMine && selectedMessageId === (m.id || i) && <button aria-label="حذف الرسالة" onClick={(e) => { e.stopPropagation(); handleDelete(m.id); setSelectedMessageId(null); }} className="absolute -left-10 top-1/2 -translate-y-1/2 rounded-full bg-white p-2 shadow-md"><Trash2 className="h-3.5 w-3.5 text-red-500" /></button>}
                    </div>
                  </div>
                  <span className={`pt-1.5 text- text-slate-400 ${isMine? "pr-2" : "pl-10"}`}>{formatTime(m.created_at)}</span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        </RemoteState>
      </div>

      <div dir="rtl" className="flex items-center gap-2 border-t border-slate-100 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex min-h- flex-1 items-center gap-2 rounded-full border border-slate-100 bg-[#f1f5f9] px-4 py-2.5 transition-all focus-within:border-[#39ff88] focus-within:ring-2 focus-within:ring-[#39ff88]/20 dark:border-slate-700 dark:bg-slate-800">
          <input value={messageText} onChange={(e) => { setMessageText(e.target.value); setRobotMood(e.target.value.trim()? "typing" : "idle"); }} onKeyDown={(e) => e.key === "Enter" && handleSend()} placeholder="اكتب رسالتك للربع.." className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-white" />
          <button aria-label="إرسال الرسالة" onClick={handleSend} disabled={sending ||!messageText.trim()} className="text-[#39ff88] transition-opacity disabled:opacity-30"><Send className="h-5 w-5" /></button>
        </div>
        <input id="att" type="file" className="hidden" onChange={handleAttachment} />
        <button aria-label="إضافة مرفق" onClick={() => document.getElementById("att")?.click()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#00d978] text-[#032015] shadow-sm transition-colors hover:bg-[#39ff88]"><Plus className="h-5 w-5" /></button>
      </div>
    </PhoneShell>
  );
}
