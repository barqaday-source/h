import { createFileRoute } from "@tanstack/react-router";
import { Phone, Plus, Send, Trash2 } from "lucide-react";
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
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.17);
    oscillator.addEventListener("ended", () => context.close());
  } catch {
    // الصوت تجميلي فقط، ولا يجب أن يمنع الدردشة عند عدم دعمه.
  }
}

// الروبوت الجديد من الإيميل - نظيف بدون أسماء
function FazaaRobotNew({ size = 52 }) {
  return (
    <div style={{ width: size, height: size }} className="shrink-0">
      <svg viewBox="0 0 200 200" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" aria-label="كرة قدم بفزعة">
        <defs>
          <radialGradient id="ball-neon" cx="35%" cy="25%">
            <stop stopColor="#ecfdf5" />
            <stop offset="0.5" stopColor="#a7f3d0" />
            <stop offset="1" stopColor="#34d399" />
          </radialGradient>
          <filter id="ball-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <style>{`
            @keyframes stare {0%,100%{transform:translate(0,0)}35%{transform:translate(-3px,1px)}65%{transform:translate(3px,-1px)}}
            @keyframes ballFloat {0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-3px) rotate(2deg)}}
            .staring-eyes{animation:stare 3.5s ease-in-out infinite}
            .floating-ball{transform-origin:100px 100px;animation:ballFloat 3s ease-in-out infinite}
          `}</style>
        </defs>
        <circle cx="100" cy="100" r="82" fill="#39ff88" opacity="0.13" filter="url(#ball-glow)" />
        <g className="floating-ball">
          <circle cx="100" cy="100" r="68" fill="url(#ball-neon)" stroke="#39ff88" strokeWidth="5" />
          <path d="M100 62 118 75 111 97 89 97 82 75Z" fill="#064e3b" stroke="#022c22" strokeWidth="3" />
          <path d="m82 75-22 7m58-7 22 7m-29 15 14 22m-25-22-14 22M60 82l8 39m72-39-8 39" fill="none" stroke="#065f46" strokeWidth="5" strokeLinecap="round" />
          <g className="staring-eyes">
            <ellipse cx="78" cy="82" rx="15" ry="18" fill="white" stroke="#022c22" strokeWidth="3" />
            <ellipse cx="122" cy="82" rx="15" ry="18" fill="white" stroke="#022c22" strokeWidth="3" />
            <circle cx="80" cy="84" r="6" fill="#071c16" />
            <circle cx="124" cy="84" r="6" fill="#071c16" />
            <circle cx="82" cy="81" r="2" fill="#39ff88" />
            <circle cx="126" cy="81" r="2" fill="#39ff88" />
          </g>
          <path d="M82 119 Q100 132 118 119" fill="none" stroke="#064e3b" strokeWidth="4" strokeLinecap="round" />
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
  const [userId, setUserId] = useState(null);
  const [selectedMessageId, setSelectedMessageId] = useState(null);

  const quickActions = [
    { icon: "⚽", label: "فزعة", full: "يا ولد ناقصنا لاعبين، فزعة للربع! ⚽" },
    { icon: "👥", label: "تجميعة", full: "منو جاهز ينزل معنا اليوم بالملعب؟ 🔥" },
    { icon: "🧤", label: "حارس", full: "محتاجين حارس مرتب؟ 🧤" },
    { icon: "📍", label: "المكان", full: "وين اللعبة؟ دزوا لوكيشن 📍" },
  ];

  const messagesState = useRemoteData(() => {
    if (!matchId || matchId === 'undefined') return Promise.resolve([]);
    return fetchMessages(matchId);
  }, [matchId]);
  const messages = messagesState.data?? [];

  useEffect(() => {
    supabase?.auth.getSession().then(({data})=>{
      const id = data?.session?.user?.id;
      if(id && id!== 'undefined' && id!== 'null') setUserId(id);
    });
    fetchCurrentMatchId().then(id=>{ if(id && id!== 'undefined') setMatchId(id); }).catch(()=>{});
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  const reloadRef = useRef(messagesState.reload);
  useEffect(() => { reloadRef.current = messagesState.reload; });
  useEffect(() => {
    if (!isSupabaseConfigured ||!supabase ||!matchId || matchId === 'undefined') return;
    const ch = supabase.channel(`messages:${matchId}`).on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` }, () => reloadRef.current?.()).subscribe();
    return () => supabase.removeChannel(ch);
  }, [matchId]);

  const handleSend = async () => {
    const body = messageText.trim(); if (!body) return;
    if (!userId || userId === 'undefined' || userId === 'null') { toast.error("جاري تحميل الجلسة"); return; }
    if (!matchId || matchId === 'undefined') return;
    setSending(true);
    try { await sendMessage({ matchId, body }); playChatSound("send"); setMessageText(""); await messagesState.reload(); } catch (e) { toast.error(e.message); } finally { setSending(false); }
  };
  const handleAttachment = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!userId || userId === 'undefined') { toast.error("انتظر تحميل الجلسة"); return; }
    setSending(true);
    try { const att = await uploadChatAttachment(file); await sendMessage({ matchId, body: file.name, attachment: att }); playChatSound("send"); await messagesState.reload(); } catch (err) { toast.error(err.message); } finally { setSending(false); e.target.value=""; }
  };
  const handleDelete = async (msgId) => {
    if (!msgId || msgId === 'undefined') return;
    try { await supabase.from('messages').delete().eq('id', msgId); playChatSound("delete"); await messagesState.reload(); } catch { toast.error("ما انحذفت"); }
  };

  return (
    <PhoneShell withNav>
      <StatusBar />
      {/* هيدر متوازن: أدوات جانبية وروبوت مركزي */}
      <header dir="rtl" className="relative flex min-h-[92px] items-center justify-between border-b border-slate-100 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <ThemeToggle className="h-10 w-10 rounded-full border border-slate-200 bg-slate-50 shadow-sm dark:border-slate-700 dark:bg-slate-800" />
        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-emerald-950/60 shadow-[0_0_18px_rgba(57,255,136,0.25)]">
            <FazaaRobotNew size={44} />
          </div>
          <h1 className="mt-1 text-base font-extrabold tracking-wide text-slate-900 dark:text-white">فزعة</h1>
          <span className="text-[10px] font-medium text-[#39ff88]">دردشة الربع</span>
        </div>
        <button aria-label="اتصال" className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 shadow-sm transition-colors hover:border-[#39ff88] hover:bg-emerald-950/40 hover:text-[#39ff88] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <Phone className="h-4 w-4" />
        </button>
      </header>

      {messageText.length === 0 && (
        <div dir="rtl" className="border-b border-slate-100 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex gap-2 overflow-x-auto no-scrollbar justify-center">
            {quickActions.map((c)=>(
              <button key={c.label} onClick={()=>setMessageText(c.full)} className="inline-flex w-fit shrink-0 items-center whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700 transition-all hover:border-[#39ff88] hover:bg-[#39ff88] hover:text-[#032015] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <span className="ml-1.5">{c.icon}</span>{c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div dir="rtl" className="flex-1 space-y-3 overflow-y-auto bg-[#f8fafc] px-4 py-4 dark:bg-[#0b1215]">
        <RemoteState {...messagesState} empty={!messages.length}>
          <>
            {messages.map((m,i)=>{
              const isMine = m.mine;
              return (
                <div key={m.id||i} className={`group flex flex-col ${isMine?"items-end":"items-start"}`}>
                  <div className={`flex max-w-full items-end gap-2 ${isMine?"flex-row":"flex-row-reverse"}`}>
                    {!isMine && <Avatar name={m.author||"لاعب"} size="h-8 w-8" />}
                    <div
                      className={`relative inline-block w-fit max-w-[78%] cursor-pointer rounded-[20px] px-4 py-3 text-sm leading-relaxed shadow-[0_2px_8px_rgba(0,0,0,0.06)] whitespace-pre-wrap break-words transition-shadow ${isMine?"rounded-br-[6px] bg-[#00d978] text-[#032015]":"rounded-bl-[6px] border border-slate-100 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"} ${selectedMessageId === (m.id || i) ? "ring-2 ring-[#39ff88] ring-offset-2 ring-offset-[#0b1215]" : ""}`} onClick={() => setSelectedMessageId(selectedMessageId === (m.id || i) ? null : (m.id || i))}
                      style={{ overflowWrap: 'anywhere' }}
                    >
                      {m.attachmentUrl && m.messageType==="image" && <img src={m.attachmentUrl} className="mb-2.5 max-h-60 w-fit rounded-[14px] object-cover" alt="" />}
                      {m.attachmentUrl && m.messageType==="audio" && <audio controls src={m.attachmentUrl} className="mb-1 w-full rounded-full" />}
                      <span>{m.text||m.body}</span>
                      {isMine && selectedMessageId === (m.id || i) && <button aria-label="حذف الرسالة" onClick={(e)=>{ e.stopPropagation(); handleDelete(m.id); setSelectedMessageId(null); }} className="absolute -left-10 top-1/2 -translate-y-1/2 rounded-full bg-white p-2 shadow-md"><Trash2 className="h-3.5 w-3.5 text-red-500" /></button>}
                    </div>
                  </div>
                  <span className={`pt-1.5 text-[11px] text-slate-400 ${isMine?"pr-2":"pl-10"}`}>{formatTime(m.created_at)}</span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        </RemoteState>
      </div>

      <div dir="rtl" className="flex items-center gap-2 border-t border-slate-100 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex min-h-[46px] flex-1 items-center gap-2 rounded-full border border-slate-100 bg-[#f1f5f9] px-4 py-2.5 transition-all focus-within:border-[#39ff88] focus-within:ring-2 focus-within:ring-[#39ff88]/20 dark:border-slate-700 dark:bg-slate-800">
          <input value={messageText} onChange={e=>setMessageText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSend()} placeholder="اكتب رسالتك للربع.." className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-white" />
          <button aria-label="إرسال الرسالة" onClick={handleSend} disabled={sending ||!messageText.trim()} className="text-[#39ff88] transition-opacity disabled:opacity-30"><Send className="h-5 w-5" /></button>
        </div>
        <input id="att" type="file" className="hidden" onChange={handleAttachment} />
        <button aria-label="إضافة مرفق" onClick={()=>document.getElementById("att")?.click()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#00d978] text-[#032015] shadow-sm transition-colors hover:bg-[#39ff88]"><Plus className="h-5 w-5" /></button>
      </div>
    </PhoneShell>
  );
}
