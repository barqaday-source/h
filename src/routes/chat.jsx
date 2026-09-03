import { createFileRoute } from "@tanstack/react-router";
import { Phone, Plus, Send } from "lucide-react";
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

// فزعة نفسه بدون توهج - تصميمك الأصلي
function FazaaRobotOriginal({ size = 64 }) {
  return (
    <div style={{ width: size, height: size }} className="shrink-0">
      <svg viewBox="0 0 400 400" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="iraqi-shirt" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#ffffff" /><stop offset="100%" stopColor="#e2e8f0" /></linearGradient>
          <linearGradient id="green-accents" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#16a34a" /><stop offset="100%" stopColor="#15803d" /></linearGradient>
          <linearGradient id="robot-metal" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#38bdf8" /><stop offset="50%" stopColor="#0284c7" /><stop offset="100%" stopColor="#0369a1" /></linearGradient>
          <style>{`@keyframes floatAnime{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}} @keyframes ballSpin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}} @keyframes blink{0%,90%,100%{transform:scaleY(1)}95%{transform:scaleY(0.1)}}.anime-bot{animation:floatAnime 3s ease-in-out infinite;transform-origin:center}.ball-rotate{animation:ballSpin 6s linear infinite;transform-origin:0 0}.blink{transform-origin:200px 105px;animation:blink 4s infinite}`}</style>
        </defs>
        <g className="anime-bot">
          <rect x="150" y="270" width="22" height="50" rx="10" fill="#0284c7" /><rect x="228" y="270" width="22" height="50" rx="10" fill="#0284c7" />
          <path d="M140 315 H175 V325 H140 Z" fill="#16a34a" /><path d="M225 315 H260 V325 H225 Z" fill="#16a34a" />
          <rect x="130" y="150" width="140" height="125" rx="35" fill="url(#iraqi-shirt)" stroke="#0284c7" strokeWidth="3" />
          <path d="M132 165 C132 165 145 220 145 260" stroke="#16a34a" strokeWidth="10" strokeLinecap="round" fill="none" />
          <path d="M268 165 C268 165 255 220 255 260" stroke="#16a34a" strokeWidth="10" strokeLinecap="round" fill="none" />
          <text x="200" y="225" fontFamily="Arial" fontWeight="900" fontSize="48" fill="#16a34a" textAnchor="middle">15</text>
          <path d="M130 165 L85 190 L95 215" fill="none" stroke="url(#robot-metal)" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" /><circle cx="85" cy="190" r="10" fill="#16a34a" />
          <path d="M270 165 L315 180 L305 210" fill="none" stroke="url(#robot-metal)" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" /><circle cx="315" cy="180" r="10" fill="#16a34a" />
          <g transform="translate(0,-10)"><rect x="140" y="65" width="120" height="90" rx="32" fill="url(#robot-metal)" stroke="#fff" strokeWidth="3" /><rect x="128" y="95" width="16" height="35" rx="8" fill="#16a34a" /><rect x="256" y="95" width="16" height="35" rx="8" fill="#16a34a" /><g className="blink"><rect x="155" y="85" width="90" height="45" rx="18" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" /><circle cx="185" cy="107" r="10" fill="#38bdf8" /><circle cx="183" cy="104" r="4" fill="#fff" /><circle cx="215" cy="107" r="10" fill="#38bdf8" /><circle cx="213" cy="104" r="4" fill="#fff" /></g><line x1="200" y1="65" x2="200" y2="40" stroke="#16a34a" strokeWidth="5" strokeLinecap="round" /><circle cx="200" cy="35" r="8" fill="#fff" stroke="#16a34a" strokeWidth="3" /></g>
          <g className="ball-rotate" transform="translate(270,260)"><circle cx="0" cy="0" r="22" fill="#fff" stroke="#0f172a" strokeWidth="2.5" /><polygon points="0,-8 7,-3 4,6 -4,6 -7,-3" fill="#0f172a" /></g>
        </g>
      </svg>
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
  const [fazaaOpen, setFazaaOpen] = useState(true);

  const quickActions = [
    { icon: "⚽", label: "فزعة", full: "يا ولد ناقصنا لاعبين، فزعة للربع! ⚽" },
    { icon: "👥", label: "تجميعة", full: "منو جاهز ينزل معنا اليوم بالملعب؟ 🔥" },
    { icon: "🧤", label: "حارس", full: "محتاجين حارس مرتب؟ 🧤" },
    { icon: "📍", label: "المكان", full: "وين اللعبة؟ دزوا لوكيشن 📍" },
  ];

  const messagesState = useRemoteData(() => fetchMessages(matchId), [matchId]);
  const messages = messagesState.data?? [];
  useEffect(() => { fetchCurrentMatchId().then(id=>{ if(id) setMatchId(id); }).catch(()=>{}); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  const reloadRef = useRef(messagesState.reload);
  useEffect(() => { reloadRef.current = messagesState.reload; });
  useEffect(() => {
    if (!isSupabaseConfigured ||!supabase ||!matchId) return;
    const ch = supabase.channel(`messages:${matchId}`).on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` }, () => reloadRef.current?.()).subscribe();
    return () => supabase.removeChannel(ch);
  }, [matchId]);

  const handleSend = async () => {
    const body = messageText.trim(); if (!body) return;
    setSending(true);
    try { await sendMessage({ matchId, body }); setMessageText(""); await messagesState.reload(); } catch (e) { toast.error(e.message); } finally { setSending(false); }
  };
  const handleAttachment = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setSending(true);
    try { const att = await uploadChatAttachment(file); await sendMessage({ matchId, body: file.name, attachment: att }); await messagesState.reload(); } catch (err) { toast.error(err.message); } finally { setSending(false); e.target.value=""; }
  };

  const showChips = messageText.length === 0 && fazaaOpen;

  return (
    <PhoneShell withNav>
      <StatusBar />
      {/* هيدر بهوية خضرا */}
      <div className="flex items-center justify-between border-b border-emerald-100 dark:border-emerald-900/20 bg-white dark:bg-slate-900 px-4 py-3">
        <ThemeToggle className="h-9 w-9" />
        <div className="text-center">
          <h2 className="text- font-extrabold">الدردشة العامة للربع</h2>
          <p className="text- font-bold text-emerald-600 flex items-center justify-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> فزعة متصل</p>
        </div>
        <button className="h-9 w-9 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center"><Phone className="h-4 w-4" /></button>
      </div>

      {/* منطقة الرسائل */}
      <div className="relative flex-1 overflow-y-auto px-4 py-4 bg-[#f8fafc] dark:bg-[#0b1215] space-y-3 no-scrollbar pb-28">
        <RemoteState {...messagesState} empty={!messages.length}>
          <>
            {messages.map((m,i)=>{
              const isMine = m.mine;
              return (
                <div key={m.id||i} className={`flex flex-col ${isMine?"items-end":"items-start"}`}>
                  <div className={`flex gap-2 items-end ${isMine?"flex-row":"flex-row-reverse"}`}>
                    {!isMine && <Avatar name={m.author||"لاعب"} size="h-7 w-7" />}
                    <div className={`max-w-[75%] rounded- px-4 py-2.5 text- shadow-sm ${isMine?"rounded-br- bg-emerald-500 text-white":"rounded-bl- bg-white dark:bg-slate-800 border text-slate-800 dark:text-slate-100"}`}>
                      {m.attachmentUrl && m.messageType==="image"? <img src={m.attachmentUrl} className="mb-2 rounded-xl max-h-48" />:null}
                      <span>{m.text||m.body}</span>
                    </div>
                  </div>
                  <span className={`pt-1 text- text-slate-400 ${isMine?"pr-1":"pl-9"}`}>{formatTime(m.created_at)}</span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        </RemoteState>

        {/* زر فزعة العائم فوق الشات */}
        <div className="pointer-events-none absolute bottom- left-0 right-0 flex flex-col items-center gap-2">
          {/* زر الروبوت العائم */}
          <div className="pointer-events-auto">
            <button
              onClick={()=>setFazaaOpen(v=>!v)}
              className="flex h- w- items-center justify-center rounded-full bg-white dark:bg-slate-800 border-2 border-emerald-500 shadow-[0_8px_24px_rgba(22,163,74,0.25)] hover:scale-105 active:scale-95 transition-transform"
              aria-label="فزعة"
            >
              <FazaaRobotOriginal size={56} />
            </button>
            <div className="mt-1 text-center">
              <span className="rounded-full bg-slate-900 text-white text- font-bold px-2 py-0.5">فزعة</span>
            </div>
          </div>

          {/* الاقتراحات تحته مباشرة */}
          {showChips && (
            <div className="pointer-events-auto w-full px-2">
              <div className="mx-auto max-w- rounded-2xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border border-emerald-100 dark:border-slate-700 p-2 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
                <p className="pb-2 text-center text- font-bold text-slate-600 dark:text-slate-300">هنا تريد فزعة؟</p>
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar justify-center">
                  {quickActions.map((c)=>(
                    <button key={c.label} onClick={()=>setMessageText(c.full)} className="shrink-0 flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 text- font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500 hover:text-white transition-colors">
                      <span>{c.icon}</span>{c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* خانة الكتابة - خضرا */}
      <div className="border-t border-emerald-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-full bg-[#f1f5f9] dark:bg-slate-800 border border-emerald-100 dark:border-slate-700 px-4 py-2.5 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100">
          <input value={messageText} onChange={e=>setMessageText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSend()} placeholder="اكتب رسالتك للربع.." className="w-full bg-transparent text- outline-none" />
          <button onClick={handleSend} disabled={sending} className="text-emerald-600"><Send className="h-5 w-5" /></button>
        </div>
        <input id="att" type="file" className="hidden" onChange={handleAttachment} />
        <button onClick={()=>document.getElementById("att")?.click()} className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center"><Plus className="h-4 w-4" /></button>
      </div>
    </PhoneShell>
  );
}
