import { createFileRoute } from "@tanstack/react-router";
import { Mic, MicOff, Phone, PhoneOff, Plus, Send, Smile, UserPlus, ArrowRight } from "lucide-react";
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
const ICE_SERVERS = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

function FazaaMiniAvatar({ size = 44 }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full bg-blue-400 blur- opacity-50" />
      <div className="relative h-full w-full overflow-hidden rounded-full border-2 border-white dark:border-slate-800 bg-white shadow">
        <svg viewBox="0 0 400 400" width="100%" height="100%" className="scale-[1.8] translate-y-1">
          <defs>
            <linearGradient id="s1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#fff" /><stop offset="100%" stopColor="#e2e8f0" /></linearGradient>
            <linearGradient id="s2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#38bdf8" /><stop offset="50%" stopColor="#0284c7" /><stop offset="100%" stopColor="#0369a1" /></linearGradient>
            <style>{`@keyframes blink{0%,90%,100%{transform:scaleY(1)}95%{transform:scaleY(0.1)}}.blink{transform-origin:200px 105px;animation:blink 4s infinite}`}</style>
          </defs>
          <g><rect x="130" y="150" width="140" height="125" rx="35" fill="url(#s1)" stroke="#0284c7" strokeWidth="3" /><text x="200" y="225" fontFamily="Arial" fontWeight="900" fontSize="48" fill="#16a34a" textAnchor="middle">15</text><rect x="140" y="65" width="120" height="90" rx="32" fill="url(#s2)" stroke="#fff" strokeWidth="3" /><g className="blink"><rect x="155" y="85" width="90" height="45" rx="18" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" /><circle cx="185" cy="107" r="10" fill="#38bdf8" /><circle cx="215" cy="107" r="10" fill="#38bdf8" /></g></g>
        </svg>
      </div>
      <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
      </span>
    </div>
  );
}

function ChatScreen() {
  const [matchId, setMatchId] = useState(GENERAL_MATCH_ID);
  const [matchName, setMatchName] = useState("الدردشة العامة للربع");
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const messagesEndRef = useRef(null);
  const [inCall, setInCall] = useState(false);
  const [callStatus, setCallStatus] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const callChannelRef = useRef(null);
  const recorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const quickActions = [
    { icon: "⚽", label: "جمعية جديدة", full: "يا ولد ناقصنا لاعبين، فزعة للربع! ⚽" },
    { icon: "👥", label: "منو جاهز؟", full: "منو جاهز ينزل معنا اليوم بالملعب؟ 🔥" },
    { icon: "🧤", label: "محتاج حارس", full: "محتاجين حارس مرتب، منو موجود؟ 🧤" },
    { icon: "🏟", label: "حجز ملعب", full: "وين اللعبة؟ دزوا لوكيشن 📍" },
  ];

  useEffect(() => { fetchCurrentMatchId().then((id) => { if (id && id!== GENERAL_MATCH_ID) { setMatchId(id); setMatchName("دردشة المباراة"); } }).catch(()=>{}); }, []);
  const messagesState = useRemoteData(() => fetchMessages(matchId), [matchId]);
  const messages = messagesState.data?? [];
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  const reloadRef = useRef(messagesState.reload);
  useEffect(() => { reloadRef.current = messagesState.reload; });
  useEffect(() => {
    if (!isSupabaseConfigured ||!supabase ||!matchId) return;
    const ch = supabase.channel(`messages:${matchId}`).on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` }, () => reloadRef.current?.()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [matchId]);

  const handleAttachment = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setSending(true);
    try { const att = await uploadChatAttachment(file); await sendMessage({ matchId, body: file.name, attachment: att }); await messagesState.reload(); } catch (err) { toast.error(err.message); } finally { setSending(false); e.target.value=""; }
  };
  const handleSend = async () => {
    const body = messageText.trim(); if (!body) return;
    setSending(true);
    try { await sendMessage({ matchId, body }); setMessageText(""); await messagesState.reload(); } catch (e) { toast.error(e.message); } finally { setSending(false); }
  };

  const showChips = messageText.length === 0;

  return (
    <PhoneShell withNav>
      <StatusBar />
      {/* هيدر نظيف بدون ايقونة متابعة وبدون زر استعلام */}
      <div className="flex items-center justify-between border-b border-border/40 bg-white/90 dark:bg-slate-900/90 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <FazaaMiniAvatar size={42} />
          <div>
            <h2 className="text- font-extrabold leading-none">الدردشة العامة للربع</h2>
            <p className="pt-1 text- text-emerald-600 font-bold flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> فزعة متصل</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => toast.info("قريباً: مكالمة جماعية")} className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600"><Phone className="h-4 w-4" /></button>
          <ThemeToggle className="h-9 w-9" />
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 no-scrollbar bg-[#f8fafc] dark:bg-[#0a1220]">
        <RemoteState {...messagesState} empty={!messages.length}>
          <>
            {messages.map((m, i) => {
              const txt = m.text || m.body;
              const author = m.author || "لاعب";
              return (
                <div key={m.id || i} className={`flex items-end gap-2 ${m.mine? "flex-row":"flex-row-reverse"}`}>
                  {!m.mine? <Avatar name={author} size="h-8 w-8" />:null}
                  <div className={`${m.mine? "text-left":"text-right"}`}>
                    {!m.mine? <p className="pb-1 text- text-muted-foreground">{author}</p>:null}
                    <div className={`max-w- rounded-2xl px-3.5 py-2.5 text- ${m.mine? "bg-blue-600 text-white":"bg-white dark:bg-slate-800 border shadow-sm"}`}>{txt}</div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        </RemoteState>
      </div>

      {showChips && (
        <div className="border-t bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl px-2 py-2.5">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {quickActions.map((c) => (
              <button key={c.label} onClick={()=>setMessageText(c.full)} className="shrink-0 flex items-center gap-1.5 rounded-full bg-white dark:bg-slate-800 border px-3.5 py-2 text- font-semibold shadow-sm hover:bg-blue-50">
                <span>{c.icon}</span>{c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 border-t bg-white dark:bg-slate-900 px-3 py-2.5">
        <div className="flex flex-1 items-center gap-2 rounded-full bg-[#f1f5f9] dark:bg-slate-800 px-4 py-2.5">
          <input value={messageText} onChange={e=>setMessageText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSend()} placeholder="اكتب رسالتك للربع.." className="w-full bg-transparent text- outline-none" />
          <button onClick={handleSend} disabled={sending} className="text-blue-600 disabled:opacity-40"><Send className="h-4 w-4" /></button>
        </div>
        <input id="att" type="file" className="hidden" onChange={handleAttachment} />
        <button onClick={()=>document.getElementById("att")?.click()} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f1f5f9] dark:bg-slate-800"><Plus className="h-4 w-4" /></button>
      </div>
    </PhoneShell>
  );
}
