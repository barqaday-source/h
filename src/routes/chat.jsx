import { createFileRoute } from "@tanstack/react-router";
import { Info, Mic, MicOff, Phone, PhoneOff, Plus, Send, Smile, UserPlus } from "lucide-react";
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

function FazaaBot({ className = "h-28 w-28", speaking = false }) {
  return (
    <div className={`relative ${className} ${speaking? "scale-105" : "scale-100"} transition-transform duration-300`}>
      <svg viewBox="0 0 200 220" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_0_25px_rgba(37,99,235,0.5)]">
        <defs>
          <linearGradient id="blue-glass" x1="60" y1="85" x2="140" y2="135" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1d4ed8" stopOpacity="0.8" /><stop offset="1" stopColor="#0f172a" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="jet-glow" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#38bdf8" /><stop offset="1" stopColor="#38bdf8" stopOpacity="0" /></linearGradient>
          <style>{`@keyframes blink{0%,90%,100%{transform:scaleY(1)}95%{transform:scaleY(0.1)}} @keyframes lookAround{0%,100%{transform:translate(0,0)}30%{transform:translate(-2px,1px)}70%{transform:translate(2px,-1px)}} @keyframes jetPulse{0%,100%{opacity:0.6;transform:scaleY(1)}50%{opacity:1;transform:scaleY(1.3)}}.blinking-eyes{transform-origin:100px 47px;animation:blink 4s infinite}.gazing-pupils{animation:lookAround 3s infinite ease-in-out}.thruster-ray{transform-origin:center bottom;animation:jetPulse 0.4s infinite alternate}`}</style>
        </defs>
        <circle cx="100" cy="110" r="80" fill="#2563eb" opacity="0.15" />
        <g className="thruster-ray"><path d="M75 180 L70 215 L80 180 Z" fill="url(#jet-glow)" /><path d="M125 180 L130 215 L120 180 Z" fill="url(#jet-glow)" /></g>
        <rect x="65" y="140" width="18" height="40" rx="9" fill="#1e3a8a" /><rect x="117" y="140" width="18" height="40" rx="9" fill="#1e3a8a" />
        <path d="M60 175 H88 V185 H60 Z" fill="#3b82f6" /><path d="M112 175 H140 V185 H112 Z" fill="#3b82f6" />
        <rect x="50" y="75" width="100" height="70" rx="24" fill="#0f172a" stroke="#2563eb" strokeWidth="4" /><path d="M60 85 H140 V135 H60 Z" fill="url(#blue-glass)" />
        <path d="M112 96 C112 92 104 90 100 90 C90 90 88 96 92 102 C97 108 108 110 108 116 C108 122 98 124 90 120" stroke="#60a5fa" strokeWidth="5" strokeLinecap="round" fill="none" />
        <path d="M45 90 L20 110 L30 130" stroke="#2563eb" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d="M155 90 L180 110 L170 130" stroke="#2563eb" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <circle cx="30" cy="130" r="8" fill="#60a5fa" /><circle cx="170" cy="130" r="8" fill="#60a5fa" />
        <rect x="60" y="25" width="80" height="50" rx="20" fill="#1e293b" stroke="#3b82f6" strokeWidth="3" />
        <g className="blinking-eyes"><rect x="70" y="35" width="60" height="25" rx="10" fill="#0284c7" /><g className="gazing-pupils"><ellipse cx="88" cy="47" rx="5" ry="6" fill="#ffffff" /><ellipse cx="112" cy="47" rx="5" ry="6" fill="#ffffff" /></g></g>
        <path d="M100 25 V12" stroke="#60a5fa" strokeWidth="3" strokeLinecap="round" /><circle cx="100" cy="10" r="4" fill="#38bdf8" />
      </svg>
    </div>
  );
}

function ChatScreen() {
  const [matchId, setMatchId] = useState(GENERAL_MATCH_ID);
  const [matchName, setMatchName] = useState("الدردشة العامة للربع");
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [stickersOpen, setStickersOpen] = useState(false);
  const [botSpeaking, setBotSpeaking] = useState(true);
  const messagesEndRef = useRef(null);
  const [inCall, setInCall] = useState(false);
  const [callStatus, setCallStatus] = useState("في الانتظار...");
  const [isMuted, setIsMuted] = useState(false);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const callChannelRef = useRef(null);
  const recorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const suggestions = [
    { id: "fazaa", label: "فزعة", icon: "⚽", text: "يا ولد ناقصنا لاعبين، فزعة للربع! ⚽" },
    { id: "tajmee", label: "تجميعة", icon: "👥", text: "منو جاهز ينزل معنا اليوم بالملعب؟ 🔥" },
    { id: "hares", label: "حارس", icon: "🧤", text: "محتاجين حارس مرتب، منو موجود؟ 🧤" },
    { id: "makan", label: "المكان", icon: "📍", text: "وين اللعبة؟ دزوا لوكيشن 📍" },
  ];

  useEffect(() => { fetchCurrentMatchId().then((id) => { if (id && id!== GENERAL_MATCH_ID) { setMatchId(id); setMatchName("دردشة المباراة الحالية"); } }).catch(() => {}); }, []);
  const messagesState = useRemoteData(() => fetchMessages(matchId), [matchId]);
  const messages = messagesState.data?? [];
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  const reloadRef = useRef(messagesState.reload);
  useEffect(() => { reloadRef.current = messagesState.reload; });
  useEffect(() => {
    if (!isSupabaseConfigured ||!supabase ||!matchId) return undefined;
    const msgChannel = supabase.channel(`messages:${matchId}`).on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` }, () => reloadRef.current?.()).subscribe();
    const callChannel = supabase.channel(`call:${matchId}`);
    callChannelRef.current = callChannel;
    callChannel.on("broadcast", { event: "webrtc-signal" }, async ({ payload }) => {
      if (!peerConnectionRef.current && payload.type === "offer") await handleIncomingCall(payload.offer);
      else if (peerConnectionRef.current) {
        if (payload.type === "answer") { await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(payload.answer)); setCallStatus("متصل باللاعب الآخر 🎙"); }
        else if (payload.type === "candidate") { try { await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch {} }
        else if (payload.type === "end-call") { cleanUpCall(); toast.info("أغلق الطرف الآخر المكالمة"); }
      }
    }).subscribe();
    return () => { supabase.removeChannel(msgChannel); supabase.removeChannel(callChannel); };
  }, [matchId]);

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pc.onicecandidate = (event) => { if (event.candidate && callChannelRef.current) callChannelRef.current.send({ type: "broadcast", event: "webrtc-signal", payload: { type: "candidate", candidate: event.candidate } }); };
    pc.ontrack = (event) => { if (remoteAudioRef.current && event.streams[0]) { remoteAudioRef.current.srcObject = event.streams[0]; remoteAudioRef.current.play().catch(()=>{}); setCallStatus("المكالمة متصلة 🔊"); } };
    peerConnectionRef.current = pc; return pc;
  };
  const startVoiceCall = async () => {
    try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); localStreamRef.current = stream; const pc = createPeerConnection(); stream.getTracks().forEach((t) => pc.addTrack(t, stream)); const offer = await pc.createOffer(); await pc.setLocalDescription(offer); callChannelRef.current?.send({ type: "broadcast", event: "webrtc-signal", payload: { type: "offer", offer } }); setInCall(true); setCallStatus("جاري الاتصال..."); toast.success("تم إرسال دعوة الاتصال"); } catch { toast.error("تعذر الوصول للميكروفون"); }
  };
  const handleIncomingCall = async (offer) => {
    try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); localStreamRef.current = stream; const pc = createPeerConnection(); stream.getTracks().forEach((t) => pc.addTrack(t, stream)); await pc.setRemoteDescription(new RTCSessionDescription(offer)); const answer = await pc.createAnswer(); await pc.setLocalDescription(answer); callChannelRef.current?.send({ type: "broadcast", event: "webrtc-signal", payload: { type: "answer", answer } }); setInCall(true); setCallStatus("متصل 🎙"); toast.info("تم الاتصال"); } catch { toast.error("تعذر فتح الميكروفون"); }
  };
  const cleanUpCall = () => { if (localStreamRef.current) { localStreamRef.current.getTracks().forEach((t) => t.stop()); localStreamRef.current = null; } if (peerConnectionRef.current) { peerConnectionRef.current.close(); peerConnectionRef.current = null; } setInCall(false); };
  const endVoiceCall = () => { callChannelRef.current?.send({ type: "broadcast", event: "webrtc-signal", payload: { type: "end-call" } }); cleanUpCall(); toast.info("تم إنهاء المكالمة"); };
  const toggleMute = () => { if (localStreamRef.current) { const audioTrack = localStreamRef.current.getAudioTracks()[0]; if (audioTrack) { audioTrack.enabled =!audioTrack.enabled; setIsMuted(!audioTrack.enabled); } } };
  const recordAudio = async () => {
    if (recording && recorderRef.current) { recorderRef.current.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size && audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type });
        setSending(true);
        try { const attachment = await uploadChatAttachment(file); await sendMessage({ matchId, body: "تسجيل صوتي 🎙", attachment }); await messagesState.reload(); } catch (e) { toast.error(e?.message || "تعذر إرسال التسجيل"); } finally { setSending(false); }
      };
      recorderRef.current = recorder; recorder.start(); setRecording(true);
      recorder.addEventListener("stop", () => { recorderRef.current = null; setRecording(false); }, { once: true });
    } catch (e) { toast.error(e?.message || "تعذر الوصول إلى الميكروفون"); }
  };
  const handleAttachment = async (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    setSending(true);
    try { const attachment = await uploadChatAttachment(file); await sendMessage({ matchId, body: file.name, attachment }); await messagesState.reload(); } catch (e) { toast.error(e?.message || "تعذر إرسال المرفق"); } finally { setSending(false); event.target.value = ""; }
  };
  const handleSend = async () => {
    const body = messageText.trim(); if (!body) return;
    setSending(true);
    try { await sendMessage({ matchId, body }); setMessageText(""); await messagesState.reload(); } catch (e) { toast.error(e?.message || "حدث خطأ في الإرسال"); } finally { setSending(false); }
  };

  return (
    <PhoneShell withNav>
      <StatusBar />
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      <div className="flex items-center justify-between border-b border-border/50 px-5 py-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => toast.info("دعوة الربع")} className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface"><UserPlus className="h-4 w-4" /></button>
          <button type="button" onClick={startVoiceCall} className="flex h-9 w-9 items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400"><Phone className="h-4 w-4" /></button>
        </div>
        <div className="text-center"><h2 className="text-base font-extrabold">الدردشة</h2><p className="text- text-primary">{matchName}</p></div>
        <div className="flex items-center gap-2"><ThemeToggle className="h-9 w-9" /><button type="button" className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface"><Info className="h-4 w-4" /></button></div>
      </div>

      {/* فزعة - روبوت + فقاعة اقتراحات واحدة */}
      <div className="relative w-full bg-gradient-to-b from-blue-950/20 via-transparent to-transparent px-4 py-3">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,0.18),transparent_70%)]" />

        <div className="relative flex items-start gap-3">
          {/* الروبوت */}
          <div className="relative shrink-0">
            <FazaaBot className="h- w- sm:h- sm:w-" speaking={botSpeaking} />
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-slate-900 border border-blue-500/30 px-2 py-0.5">
              <span className="text- font-black tracking-widest text-blue-400">فزعة</span>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            </div>
          </div>

          {/* الفقاعة الكبيرة الي بها الاقتراحات */}
          <div className="relative flex-1">
            {/* ذيل الفقاعة */}
            <div className="absolute left-0 top-6 -translate-x-1.5 h-3 w-3 rotate-45 border-b border-l border-white/10 bg-white/10 backdrop-blur-xl" />

            <div className="rounded- rounded-tl- border border-white/10 bg-white/[0.08] p-3 shadow-[0_8px_32px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-2xl">
              <p className="pb-2.5 text- font-bold text-blue-100/90">هنا تريد فزعة؟ اختار:</p>

              <div className="grid grid-cols-2 gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setMessageText(s.text)}
                    className="group flex items-center justify-center gap-1.5 rounded-full border border-white/10 bg-gradient-to-br from-white/[0.12] to-white/[0.04] px-3 py-2 text- font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_8px_rgba(0,0,0,0.15)] backdrop-blur-md transition-all hover:scale-[1.03] hover:from-blue-500/30 hover:to-blue-600/20 hover:border-blue-400/30 hover:shadow-[0_0_15px_rgba(37,99,235,0.4)] active:scale-95"
                  >
                    <span className="text-">{s.icon}</span>
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {inCall && (
        <div className="flex items-center justify-between border-b border-blue-500/20 bg-blue-500/10 p-4 backdrop-blur-md">
          <div className="flex items-center gap-3"><div className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span></div><div><p className="text-xs font-bold">مكالمة حية</p><p className="text- text-muted-foreground">{callStatus}</p></div></div>
          <div className="flex items-center gap-2"><button type="button" onClick={toggleMute} className={`rounded-full p-2.5 text-white ${isMuted? "bg-amber-600" : "bg-slate-700"}`}>{isMuted? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</button><button type="button" onClick={endVoiceCall} className="rounded-full bg-rose-600 p-2.5 text-white"><PhoneOff className="h-4 w-4" /></button></div>
        </div>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 no-scrollbar">
        <RemoteState {...messagesState} empty={!messages.length}>
          <>
            {messages.map((message, index) => {
              const textContent = message.text || message.body;
              const authorName = message.author || "لاعب";
              const mediaUrl = message.attachmentUrl;
              const mediaType = message.messageType;
              const formattedTime = message.time || (message.created_at? new Date(message.created_at).toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" }) : "الآن");
              return (
                <div key={message.id || index} className={`flex items-end gap-2 ${message.mine? "flex-row" : "flex-row-reverse"}`}>
                  {!message.mine? <Avatar name={authorName} size="h-8 w-8" /> : null}
                  <div className={message.mine? "text-left" : "text-right"}>
                    {!message.mine? <p className="pb-1 text- text-muted-foreground">{authorName}</p> : null}
                    <div className={`max-w- rounded-2xl px-3.5 py-2.5 text-sm ${message.mine? "bg-gradient-to-br from-blue-600 to-blue-700 text-white" : "border border-border bg-surface text-foreground"}`}>
                      {mediaType === "image" && mediaUrl? <img src={mediaUrl} alt="مرفق" className="mb-2 max-h-48 rounded-xl object-cover" /> : null}
                      {mediaUrl && mediaType!== "image"? <a href={mediaUrl} target="_blank" rel="noreferrer" className="mb-1 block underline">{message.attachmentName || "فتح المرفق"}</a> : null}
                      {textContent? <span>{textContent}</span> : null}
                    </div>
                    <p className="pt-1 text- text-muted-foreground">{formattedTime}</p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        </RemoteState>
      </div>

      <div className="flex items-center gap-2 border-t border-border/50 bg-surface/80 px-4 py-3 backdrop-blur-xl">
        <button type="button" onClick={recordAudio} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg ${recording? "animate-pulse ring-2 ring-rose-500" : ""}`}><Mic className="h-4 w-4" /></button>
        <button type="button" onClick={() => setStickersOpen((v) =>!v)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground"><Smile className="h-4 w-4" /></button>
        <div className="flex flex-1 items-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 shadow-inner">
          <input value={messageText} onChange={(e) => setMessageText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }} placeholder="اكتب رسالتك للربع.." className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          <button type="button" onClick={handleSend} disabled={sending} className="text-blue-500 disabled:opacity-50"><Send className="h-4 w-4" /></button>
        </div>
        <input id="chat-attachment" type="file" accept="image/*,.pdf,.doc,.docx,.zip" className="hidden" onChange={handleAttachment} />
        <button type="button" onClick={() => document.getElementById("chat-attachment")?.click()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground"><Plus className="h-4 w-4" /></button>
      </div>
    </PhoneShell>
  );
}
