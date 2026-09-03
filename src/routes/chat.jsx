import { createFileRoute } from "@tanstack/react-router";
import { Info, Mic, MicOff, Phone, PhoneOff, Plus, Send, Smile, UserPlus, X } from "lucide-react";
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

// فزعة Mini Avatar 44x44 - نفس تصميمك لكن مصغر باطار دائري متوهج
function FazaaMiniAvatar({ size = 44 }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 blur- opacity-60" />
      <div className="relative h-full w-full overflow-hidden rounded-full border-2 border-white dark:border-slate-800 bg-white shadow-[0_2px_12px_rgba(37,99,235,0.3)]">
        <svg viewBox="0 0 400 400" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" className="scale-[1.8] translate-y-1">
          <defs>
            <linearGradient id="iraqi-shirt-mini" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#ffffff" /><stop offset="100%" stopColor="#e2e8f0" /></linearGradient>
            <linearGradient id="robot-metal-mini" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#38bdf8" /><stop offset="50%" stopColor="#0284c7" /><stop offset="100%" stopColor="#0369a1" /></linearGradient>
            <style>{`@keyframes eyeBlinkMini{0%,90%,100%{transform:scaleY(1)}95%{transform:scaleY(0.1)}}.blink-mini{transform-origin:200px 105px;animation:eyeBlinkMini 4s infinite}`}</style>
          </defs>
          <g transform="translate(0, 10)">
            <rect x="130" y="150" width="140" height="125" rx="35" fill="url(#iraqi-shirt-mini)" stroke="#0284c7" strokeWidth="3" />
            <text x="200" y="225" fontFamily="Arial" fontWeight="900" fontSize="48" fill="#16a34a" textAnchor="middle">15</text>
            <rect x="140" y="65" width="120" height="90" rx="32" fill="url(#robot-metal-mini)" stroke="#ffffff" strokeWidth="3" />
            <g className="blink-mini"><rect x="155" y="85" width="90" height="45" rx="18" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" /><circle cx="185" cy="107" r="10" fill="#38bdf8" /><circle cx="215" cy="107" r="10" fill="#38bdf8" /></g>
          </g>
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
  const [showFazaaSheet, setShowFazaaSheet] = useState(false);
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

  const quickActions = [
    { id: "fazaa", icon: "⚽", label: "جمعية جديدة", full: "يا ولد ناقصنا لاعبين، فزعة للربع! ⚽" },
    { id: "tajmee", icon: "👥", label: "منو جاهز؟", full: "منو جاهز ينزل معنا اليوم بالملعب؟ 🔥" },
    { id: "hares", icon: "🧤", label: "محتاج حارس", full: "محتاجين حارس مرتب، منو موجود؟ 🧤" },
    { id: "makan", icon: "🏟", label: "حجز ملعب", full: "وين اللعبة؟ دزوا لوكيشن الملعب 📍" },
    { id: "waqt", icon: "⏰", label: "تأكيد الوقت", full: "اللعبة بيش الساعة؟ ⏰" },
  ];

  useEffect(() => { fetchCurrentMatchId().then((id) => { if (id && id!== GENERAL_MATCH_ID) { setMatchId(id); setMatchName("دردشة المباراة"); } }).catch(() => {}); }, []);
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
        if (payload.type === "answer") { await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(payload.answer)); setCallStatus("متصل 🎙"); }
        else if (payload.type === "candidate") { try { await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch {} }
        else if (payload.type === "end-call") { cleanUpCall(); toast.info("أغلق الطرف الآخر المكالمة"); }
      }
    }).subscribe();
    return () => { supabase.removeChannel(msgChannel); supabase.removeChannel(callChannel); };
  }, [matchId]);

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pc.onicecandidate = (event) => { if (event.candidate && callChannelRef.current) callChannelRef.current.send({ type: "broadcast", event: "webrtc-signal", payload: { type: "candidate", candidate: event.candidate } }); };
    pc.ontrack = (event) => { if (remoteAudioRef.current && event.streams[0]) { remoteAudioRef.current.srcObject = event.streams[0]; remoteAudioRef.current.play().catch(()=>{}); setCallStatus("متصل 🔊"); } };
    peerConnectionRef.current = pc; return pc;
  };
  const startVoiceCall = async () => { try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); localStreamRef.current = stream; const pc = createPeerConnection(); stream.getTracks().forEach((t) => pc.addTrack(t, stream)); const offer = await pc.createOffer(); await pc.setLocalDescription(offer); callChannelRef.current?.send({ type: "broadcast", event: "webrtc-signal", payload: { type: "offer", offer } }); setInCall(true); setCallStatus("جاري الاتصال..."); toast.success("تم إرسال دعوة"); } catch { toast.error("تعذر الميكروفون"); } };
  const handleIncomingCall = async (offer) => { try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); localStreamRef.current = stream; const pc = createPeerConnection(); stream.getTracks().forEach((t) => pc.addTrack(t, stream)); await pc.setRemoteDescription(new RTCSessionDescription(offer)); const answer = await pc.createAnswer(); await pc.setLocalDescription(answer); callChannelRef.current?.send({ type: "broadcast", event: "webrtc-signal", payload: { type: "answer", answer } }); setInCall(true); setCallStatus("متصل 🎙"); } catch { toast.error("تعذر الميكروفون"); } };
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
        try { const attachment = await uploadChatAttachment(file); await sendMessage({ matchId, body: "تسجيل صوتي 🎙", attachment }); await messagesState.reload(); } catch (e) { toast.error(e?.message || "تعذر الإرسال"); } finally { setSending(false); }
      };
      recorderRef.current = recorder; recorder.start(); setRecording(true);
      recorder.addEventListener("stop", () => { recorderRef.current = null; setRecording(false); }, { once: true });
    } catch (e) { toast.error(e?.message || "تعذر الميكروفون"); }
  };
  const handleAttachment = async (event) => { const file = event.target.files?.[0]; if (!file) return; setSending(true); try { const attachment = await uploadChatAttachment(file); await sendMessage({ matchId, body: file.name, attachment }); await messagesState.reload(); } catch (e) { toast.error(e?.message || "تعذر الإرسال"); } finally { setSending(false); event.target.value = ""; } };
  const handleSend = async () => { const body = messageText.trim(); if (!body) return; setSending(true); try { await sendMessage({ matchId, body }); setMessageText(""); await messagesState.reload(); } catch (e) { toast.error(e?.message || "خطأ"); } finally { setSending(false); } };

  const showChips = messageText.length === 0;

  return (
    <PhoneShell withNav>
      <StatusBar />
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* هيدر نظيف - فزعة Mini Avatar */}
      <div className="flex items-center justify-between border-b border-border/40 bg-white/80 dark:bg-slate-900/80 px-4 py-2.5 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setShowFazaaSheet(true)} className="relative">
            <FazaaMiniAvatar size={44} />
          </button>
          <div className="text-right">
            <div className="flex items-center gap-1.5">
              <h2 className="text- font-extrabold">الدردشة العامة للربع</h2>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="text- text-muted-foreground flex items-center gap-1">
              <span className="text-emerald-600 font-bold">فزعة</span> • متصل الآن
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={startVoiceCall} className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600"><Phone className="h-4 w-4" /></button>
          <ThemeToggle className="h-9 w-9" />
        </div>
      </div>

      {inCall && (
        <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/30 px-4 py-2.5">
          <div className="flex items-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /><p className="text-xs font-bold">{callStatus}</p></div>
          <div className="flex gap-2"><button onClick={toggleMute} className={`rounded-full p-2 text-white ${isMuted? "bg-amber-600":"bg-slate-700"}`}>{isMuted? <MicOff className="h-4 w-4"/>:<Mic className="h-4 w-4"/>}</button><button onClick={endVoiceCall} className="rounded-full bg-rose-600 p-2 text-white"><PhoneOff className="h-4 w-4"/></button></div>
        </div>
      )}

      {/* رسائل الشباب - نظيفة بدون مقاطعة */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 no-scrollbar bg-[#f8fafc] dark:bg-[#0f172a]/50">
        {/* رسالة ترحيبية من فزعة كأول رسالة */}
        <div className="flex gap-2">
          <div className="shrink-0"><FazaaMiniAvatar size={32} /></div>
          <div className="rounded-2xl rounded-tr-sm bg-white dark:bg-slate-800 border border-black/5 dark:border-white/10 px-3.5 py-2.5 text- shadow-sm max-w-[75%]">
            هلا بالربع! 👋 أنا <b>فزعة</b>، اضغط على أي اقتراح تحت أو اسألني أجمعلك الربع.
          </div>
        </div>

        <RemoteState {...messagesState} empty={!messages.length}>
          <>
            {messages.map((message, index) => {
              const textContent = message.text || message.body;
              const authorName = message.author || "لاعب";
              const mediaUrl = message.attachmentUrl;
              const mediaType = message.messageType;
              const formattedTime = message.time || (message.created_at? new Date(message.created_at).toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" }) : "الآن");
              return (
                <div key={message.id || index} className={`flex items-end gap-2 ${message.mine? "flex-row":"flex-row-reverse"}`}>
                  {!message.mine? <Avatar name={authorName} size="h-8 w-8" />:null}
                  <div className={message.mine? "text-left":"text-right"}>
                    {!message.mine? <p className="pb-1 text- text-muted-foreground">{authorName}</p>:null}
                    <div className={`max-w- rounded-2xl px-3.5 py-2.5 text- ${message.mine? "bg-blue-600 text-white":"bg-white dark:bg-slate-800 border border-black/5 dark:border-white/10 text-foreground shadow-sm"}`}>
                      {mediaType==="image" && mediaUrl? <img src={mediaUrl} alt="مرفق" className="mb-2 max-h-48 rounded-xl object-cover" />:null}
                      {textContent? <span>{textContent}</span>:null}
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

      {/* كروت الاقتراحات - Glassmorphism أفقي تحت الكتابة */}
      {showChips && (
        <div className="border-t border-black/5 dark:border-white/5 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl px-2 py-2.5">
          <div className="flex gap-2 overflow-x-auto no-scrollbar scroll-smooth snap-x">
            {quickActions.map((chip) => (
              <button
                key={chip.id}
                onClick={() => setMessageText(chip.full)}
                className="snap-start shrink-0 flex items-center gap-1.5 rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-black/10 dark:border-white/10 px-3.5 py-2 text- font-semibold text-slate-700 dark:text-slate-200 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-200 dark:hover:border-blue-800 hover:text-blue-700 dark:hover:text-blue-300 transition-all active:scale-95"
              >
                <span className="text-">{chip.icon}</span>
                <span className="whitespace-nowrap">{chip.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* خانة الكتابة */}
      <div className="flex items-center gap-2 border-t border-border/40 bg-white dark:bg-slate-900 px-3 py-2.5">
        <button type="button" onClick={recordAudio} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow ${recording? "animate-pulse ring-2 ring-rose-500":""}`}><Mic className="h-4 w-4" /></button>
        <div className="flex flex-1 items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-[#f1f5f9] dark:bg-slate-800 px-4 py-2.5">
          <input value={messageText} onChange={(e)=>setMessageText(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter")handleSend();}} placeholder="اكتب رسالتك للربع.." className="w-full bg-transparent text- outline-none placeholder:text-muted-foreground" />
          <button type="button" onClick={handleSend} disabled={sending} className="text-blue-600 disabled:opacity-40"><Send className="h-4 w-4" /></button>
        </div>
        <input id="chat-attachment" type="file" accept="image/*,.pdf,.doc,.docx,.zip" className="hidden" onChange={handleAttachment} />
        <button type="button" onClick={()=>document.getElementById("chat-attachment")?.click()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f1f5f9] dark:bg-slate-800 border border-black/5"><Plus className="h-4 w-4" /></button>
      </div>

      {/* Sheet فزعة عند الضغط على الأفاتار */}
      {showFazaaSheet && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={()=>setShowFazaaSheet(false)}>
          <div className="w-full max-w- rounded-t- bg-white dark:bg-slate-900 p-5 shadow-2xl animate-in slide-in-from-bottom" onClick={e=>e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-black/10" />
            <div className="flex items-center gap-3 pb-4">
              <FazaaMiniAvatar size={56} />
              <div><p className="text- font-black">فزعة - مساعد جوك</p><p className="text- text-muted-foreground">أجمعلك الربع واحجزلك ملعب بثانية</p></div>
              <button onClick={()=>setShowFazaaSheet(false)} className="ml-auto rounded-full bg-black/5 p-2"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map(c=>(
                <button key={c.id} onClick={()=>{setMessageText(c.full); setShowFazaaSheet(false);}} className="rounded-2xl border border-black/5 bg-[#f8fafc] dark:bg-slate-800 p-3 text-right hover:bg-blue-50 dark:hover:bg-blue-900/20">
                  <div className="text-">{c.icon}</div><div className="pt-1 text- font-bold">{c.label}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </PhoneShell>
  );
}
