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

// الروبوت الجديد من الإيميل - نظيف بدون أسماء
function FazaaRobotNew({ size = 52 }) {
  return (
    <div style={{ width: size, height: size }} className="shrink-0">
      <svg viewBox="0 0 200 220" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="blue-glass" x1="60" y1="85" x2="140" y2="135" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1d4ed8" stopOpacity="0.8" />
            <stop offset="1" stopColor="#0f172a" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="jet-glow" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#38bdf8" />
            <stop offset="1" stopColor="#38bdf8" stopOpacity="0" />
          </linearGradient>
          <style>{`
            @keyframes blink {0%,90%,100%{transform:scaleY(1)}95%{transform:scaleY(0.1)}}
            @keyframes lookAround{0%,100%{transform:translate(0,0)}30%{transform:translate(-2px,1px)}70%{transform:translate(2px,-1px)}}
            @keyframes jetPulse{0%,100%{opacity:0.6;transform:scaleY(1)}50%{opacity:1;transform:scaleY(1.3)}}
           .blinking-eyes{transform-origin:100px 47px;animation:blink 4s infinite}
           .gazing-pupils{animation:lookAround 3s infinite ease-in-out}
           .thruster-ray{transform-origin:center bottom;animation:jetPulse 0.4s infinite alternate}
          `}</style>
        </defs>
        <circle cx="100" cy="110" r="80" fill="#2563eb" opacity="0.15" />
        {/* الجسم */}
        <rect x="65" y="110" width="70" height="50" rx="18" fill="#e2e8f0" stroke="#0f172a" strokeWidth="2"/>
        {/* الرأس - الزجاج الأزرق */}
        <rect x="55" y="55" width="90" height="60" rx="22" fill="url(#blue-glass)" stroke="#38bdf8" strokeWidth="2"/>
        <g className="blinking-eyes">
          <circle cx="80" cy="85" r="9" fill="#38bdf8" />
          <circle cx="120" cy="85" r="9" fill="#38bdf8" />
          <g className="gazing-pupils">
            <circle cx="80" cy="85" r="3" fill="white" />
            <circle cx="120" cy="85" r="3" fill="white" />
          </g>
        </g>
        {/* نفاثات */}
        <rect x="75" y="160" width="12" height="20" rx="6" fill="#0f172a" />
        <rect x="113" y="160" width="12" height="20" rx="6" fill="#0f172a" />
        <rect className="thruster-ray" x="77" y="180" width="8" height="14" rx="4" fill="url(#jet-glow)" />
        <rect className="thruster-ray" x="115" y="180" width="8" height="14" rx="4" fill="url(#jet-glow)" style={{animationDelay:'0.2s'}} />
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
    try { await sendMessage({ matchId, body }); setMessageText(""); await messagesState.reload(); } catch (e) { toast.error(e.message); } finally { setSending(false); }
  };
  const handleAttachment = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!userId || userId === 'undefined') { toast.error("انتظر تحميل الجلسة"); return; }
    setSending(true);
    try { const att = await uploadChatAttachment(file); await sendMessage({ matchId, body: file.name, attachment: att }); await messagesState.reload(); } catch (err) { toast.error(err.message); } finally { setSending(false); e.target.value=""; }
  };
  const handleDelete = async (msgId) => {
    if (!msgId || msgId === 'undefined') return;
    try { await supabase.from('messages').delete().eq('id', msgId); await messagesState.reload(); } catch { toast.error("ما انحذفت"); }
  };

  return (
    <PhoneShell withNav>
      <StatusBar />
      {/* الهيدر - الروبوت الجديد + عنوان فقط */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
        <ThemeToggle className="h-9 w-9" />
        <div className="flex flex-col items-center">
          <FazaaRobotNew size={52} />
          <h1 className="mt-1 text- font-extrabold tracking-wide text-slate-900 dark:text-white">فزعة</h1>
        </div>
        <button className="h-9 w-9 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-600 flex items-center justify-center"><Phone className="h-4 w-4" /></button>
      </div>

      {messageText.length === 0 && (
        <div className="bg-white dark:bg-slate-900 border-b border-slate-50 dark:border-slate-800 px-3 py-2.5">
          <div className="flex gap-2 overflow-x-auto no-scrollbar justify-center">
            {quickActions.map((c)=>(
              <button key={c.label} onClick={()=>setMessageText(c.full)} className="shrink-0 w-fit inline-block rounded-full px-4 py-2 text- font-bold bg-slate-50 border border-slate-200 text-slate-700 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all">
                <span className="mr-1">{c.icon}</span>{c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 bg-[#f8fafc] dark:bg-[#0b1215] space-y-3">
        <RemoteState {...messagesState} empty={!messages.length}>
          <>
            {messages.map((m,i)=>{
              const isMine = m.mine;
              return (
                <div key={m.id||i} className={`group flex flex-col ${isMine?"items-end":"items-start"}`}>
                  <div className={`flex gap-2 items-end ${isMine?"flex-row":"flex-row-reverse"}`}>
                    {!isMine && <Avatar name={m.author||"لاعب"} size="h-7 w-7" />}
                    <div
                      className={`relative w-fit max-w-[72%] inline-block rounded- px-5 py-3.5 text- shadow-[0_2px_8px_rgba(0,0,0,0.06)] leading-relaxed whitespace-pre-wrap break-words ${isMine?"rounded-br- bg-emerald-500 text-white":"rounded-bl- bg-white dark:bg-slate-800 border border-slate-100 text-slate-800"}`}
                      style={{ overflowWrap: 'anywhere' }}
                    >
                      {m.attachmentUrl && m.messageType==="image" && <img src={m.attachmentUrl} className="mb-2.5 rounded- max-h-60 w-fit" alt="" />}
                      {m.attachmentUrl && m.messageType==="audio" && <audio controls src={m.attachmentUrl} className="mb-1 w- rounded-full" />}
                      <span>{m.text||m.body}</span>
                      {isMine && <button onClick={()=>handleDelete(m.id)} className="absolute -left-9 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 bg-white rounded-full p-2 shadow-md"><Trash2 className="h-3.5 w-3.5 text-red-500" /></button>}
                    </div>
                  </div>
                  <span className={`pt-1.5 text- text-slate-400 ${isMine?"pr-2":"pl-10"}`}>{formatTime(m.created_at)}</span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        </RemoteState>
      </div>

      <div className="border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-full bg-[#f1f5f9] dark:bg-slate-800 border border-slate-100 px-5 py-3 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100">
          <input value={messageText} onChange={e=>setMessageText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSend()} placeholder="اكتب رسالتك للربع.." className="w-full bg-transparent text- outline-none" />
          <button onClick={handleSend} disabled={sending ||!messageText.trim()} className="text-emerald-600 disabled:opacity-30"><Send className="h-5 w-5" /></button>
        </div>
        <input id="att" type="file" className="hidden" onChange={handleAttachment} />
        <button onClick={()=>document.getElementById("att")?.click()} className="h-11 w-11 rounded-full bg-emerald-500 text-white flex items-center justify-center"><Plus className="h-5 w-5" /></button>
      </div>
    </PhoneShell>
  );
}
