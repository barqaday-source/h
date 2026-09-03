
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

// فزعة نظيف - بدون توهج وبدون أطر
function FazaaRobotClean({ size = 44 }) {
  return (
    <div style={{ width: size, height: size }} className="shrink-0">
      <svg viewBox="0 0 400 400" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="iraqi-shirt-c" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#ffffff" /><stop offset="100%" stopColor="#e2e8f0" /></linearGradient>
          <linearGradient id="green-accents-c" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#16a34a" /><stop offset="100%" stopColor="#15803d" /></linearGradient>
          <linearGradient id="robot-metal-c" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#38bdf8" /><stop offset="50%" stopColor="#0284c7" /><stop offset="100%" stopColor="#0369a1" /></linearGradient>
          <style>{`@keyframes floatC{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}} @keyframes blinkC{0%,90%,100%{transform:scaleY(1)}95%{transform:scaleY(0.1)}}.bot-float{animation:floatC 3s ease-in-out infinite;transform-origin:center}.eye-blink{transform-origin:200px 105px;animation:blinkC 4s infinite}`}</style>
        </defs>
        <g className="bot-float">
          <rect x="150" y="270" width="22" height="50" rx="10" fill="#0284c7" /><rect x="228" y="270" width="22" height="50" rx="10" fill="#0284c7" />
          <rect x="130" y="150" width="140" height="125" rx="35" fill="url(#iraqi-shirt-c)" stroke="#0284c7" strokeWidth="3" />
          <text x="200" y="225" fontFamily="Arial" fontWeight="900" fontSize="48" fill="#16a34a" textAnchor="middle">15</text>
          <g transform="translate(0,-10)"><rect x="140" y="65" width="120" height="90" rx="32" fill="url(#robot-metal-c)" stroke="#fff" strokeWidth="3" />
            <g className="eye-blink"><rect x="155" y="85" width="90" height="45" rx="18" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" /><circle cx="185" cy="107" r="10" fill="#38bdf8" /><circle cx="215" cy="107" r="10" fill="#38bdf8" /></g>
            <line x1="200" y1="65" x2="200" y2="40" stroke="#16a34a" strokeWidth="5" strokeLinecap="round" /><circle cx="200" cy="35" r="8" fill="#fff" stroke="#16a34a" strokeWidth="3" /></g>
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
    const body = messageText.trim();
    if (!body) return;
    // Guard UUID
    if (!userId || userId === 'undefined' || userId === 'null') {
      toast.error("جاري تحميل الجلسة، انتظر ثانية");
      return;
    }
    if (!matchId || matchId === 'undefined') return;
    setSending(true);
    try { await sendMessage({ matchId, body }); setMessageText(""); await messagesState.reload(); } catch (e) { toast.error(e.message); } finally { setSending(false); }
  };

  const handleAttachment = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!userId || userId === 'undefined') { toast.error("انتظر تحميل الجلسة"); return; }
    setSending(true);
    try {
      const att = await uploadChatAttachment(file);
      await sendMessage({ matchId, body: file.name, attachment: att });
      await messagesState.reload();
    } catch (err) { toast.error(err.message); } finally { setSending(false); e.target.value=""; }
  };

  const handleDelete = async (msgId) => {
    if (!msgId || msgId === 'undefined') return;
    try {
      await supabase.from('messages').delete().eq('id', msgId);
      await messagesState.reload();
    } catch (e) { toast.error("ما انحذفت"); }
  };

  const showChips = messageText.length === 0;

  return (
    <PhoneShell withNav>
      <StatusBar />
      {/* الهيدر الجديد - فزعة بالنص */}
      <div className="flex items-center justify-between border-b border-emerald-100 dark:border-emerald-900/20 bg-white dark:bg-slate-900 px-4 py-2.5">
        <ThemeToggle className="h-9 w-9" />
        <div className="flex flex-col items-center gap-0.5">
          <FazaaRobotClean size={46} />
          <div className="text-center leading-none">
            <h2 className="text- font-extrabold text-slate-900 dark:text-white">فزعة</h2>
            <p className="text- font-bold text-emerald-600 flex items-center justify-center gap-1 mt-0.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> متصل الآن</p>
          </div>
        </div>
        <button className="h-9 w-9 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center"><Phone className="h-4 w-4" /></button>
      </div>

      {/* بطايق الاقتراحات تحت الهيدر مباشرة */}
      {showChips && (
        <div className="bg-white dark:bg-slate-900 border-b border-emerald-50 dark:border-slate-800 px-3 py-2.5">
          <p className="pb-2 text-center text- font-bold text-slate-500 dark:text-slate-400">هنا تريد فزعة؟</p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar justify-center">
            {quickActions.map((c)=>(
              <button key={c.label} onClick={()=>setMessageText(c.full)} className="shrink-0 flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 px-3.5 py-1.5 text- font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500 hover:text-white transition-colors">
                <span>{c.icon}</span>{c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* منطقة الرسائل - رجعت خضرا حديثة */}
      <div className="relative flex-1 overflow-y-auto px-4 py-4 bg-[#f8fafc] dark:bg-[#0b1215] space-y-3 no-scrollbar pb-6">
        <RemoteState {...messagesState} empty={!messages.length}>
          <>
            {messages.map((m,i)=>{
              const isMine = m.mine;
              return (
                <div key={m.id||i} className={`group flex flex-col ${isMine?"items-end":"items-start"}`}>
                  <div className={`flex gap-2 items-end max-w-[85%] ${isMine?"flex-row":"flex-row-reverse"}`}>
                    {!isMine && <Avatar name={m.author||"لاعب"} size="h-7 w-7" />}
                    <div className={`relative rounded- px-4 py-2.5 text- shadow-sm ${isMine?"rounded-br- bg-emerald-500 text-white":"rounded-bl- bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-slate-100"}`}>
                      {m.attachmentUrl && m.messageType==="image"? <img src={m.attachmentUrl} className="mb-2 rounded-xl max-h-60 object-cover" />:null}
                      {m.attachmentUrl && m.messageType==="audio"? <audio controls src={m.attachmentUrl} className="mb-1 w-" />:null}
                      <span className="whitespace-pre-wrap leading-relaxed">{m.text||m.body}</span>
                      {isMine && (
                        <button onClick={()=>handleDelete(m.id)} className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 bg-white dark:bg-slate-700 rounded-full p-1.5 shadow transition-opacity">
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </button>
                      )}
                    </div>
                  </div>
                  <span className={`pt-1 text- text-slate-400 ${isMine?"pr-1":"pl-9"}`}>{formatTime(m.created_at)}</span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        </RemoteState>
      </div>

      {/* خانة الكتابة - خضرا نفس قبل */}
      <div className="border-t border-emerald-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-full bg-[#f1f5f9] dark:bg-slate-800 border border-emerald-100 dark:border-slate-700 px-4 py-2.5 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100 transition-all">
          <input value={messageText} onChange={e=>setMessageText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSend()} placeholder="اكتب رسالتك للربع.." className="w-full bg-transparent text- outline-none placeholder:text-slate-400" />
          <button onClick={handleSend} disabled={sending ||!messageText.trim()} className="text-emerald-600 disabled:opacity-30 hover:text-emerald-700 transition-colors"><Send className="h-5 w-5" /></button>
        </div>
        <input id="att" type="file" accept="image/*,audio/*" className="hidden" onChange={handleAttachment} />
        <button onClick={()=>document.getElementById("att")?.click()} className="h-10 w-10 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-sm transition-colors"><Plus className="h-5 w-5" /></button>
      </div>
    </PhoneShell>
  );
}
