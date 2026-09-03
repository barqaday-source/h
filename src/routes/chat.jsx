import { createFileRoute } from "@tanstack/react-router";
import { Bot, Info, Mic, MicOff, Phone, PhoneOff, Plus, Send, Smile, UserPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar, PhoneShell, StatusBar, ThemeToggle } from "@/components/ui-kit";
import { RemoteState, useRemoteData } from "@/hooks/use-app-data";
import { fetchCurrentMatchId, fetchMessages, sendMessage, uploadChatAttachment } from "@/lib/data";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "الدردشة | جوك" },
      { name: "description", content: "التواصل والتنسيق بين اللاعبين والربع." },
    ],
  }),
  component: ChatScreen,
});

// خادم STUN المجاني من جوجل لربط الأجهزة عبر الإنترنت
const ICE_SERVERS = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

function ChatScreen() {
  const [matchId, setMatchId] = useState("general");
  const [matchName, setMatchName] = useState("الدردشة العامة للربع");
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [stickersOpen, setStickersOpen] = useState(false);

  // مرجع التمرير التلقائي لأسفل القائمة عند وصول رسالة جديدة
  const messagesEndRef = useRef(null);

  // حالات المكالمة الصوتية الحقيقية (WebRTC)
  const [inCall, setInCall] = useState(false);
  const [callStatus, setCallStatus] = useState("في الانتظار...");
  const [isMuted, setIsMuted] = useState(false);

  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const callChannelRef = useRef(null);

  const recorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    fetchCurrentMatchId()
      .then((id) => {
        if (id) {
          setMatchId(id);
          setMatchName("دردشة المباراة الحالية");
        } else {
          setMatchId("general");
          setMatchName("الدردشة العامة (مجلس الربع)");
        }
      })
      .catch(() => {
        setMatchId("general");
        setMatchName("الدردشة العامة (مجلس الربع)");
      });
  }, []);

  const messagesState = useRemoteData(
    () => fetchMessages(matchId).catch(() => []),
    [matchId]
  );
  const messages = messagesState.data ?? [];

  // التمرير التلقائي لأسفل عند تحديث قائمة الرسائل
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // حفظ مرجع الدالة لتجنب إعادة تشغيل التمرير وإلغاء القنوات عند كل إعادة رسم
  const reloadRef = useRef(messagesState.reload);
  useEffect(() => {
    reloadRef.current = messagesState.reload;
  });

  // اشتراك الرسائل والإشارات الصوتية المباشرة عبر Supabase
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !matchId) return undefined;

    // قناة الرسائل المباشرة لجميع التغييرات (إضافة / تعديل)
    const msgChannel = supabase
      .channel(`messages:${matchId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          reloadRef.current?.();
        }
      )
      .subscribe();

    // قناة الاتصال الصوتي الحقيقي (Signaling)
    const callChannel = supabase.channel(`call:${matchId}`);
    callChannelRef.current = callChannel;

    callChannel
      .on("broadcast", { event: "webrtc-signal" }, async ({ payload }) => {
        if (!peerConnectionRef.current && payload.type === "offer") {
          await handleIncomingCall(payload.offer);
        } else if (peerConnectionRef.current) {
          if (payload.type === "answer") {
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
            setCallStatus("متصل باللاعب الآخر 🎙️");
          } else if (payload.type === "candidate") {
            try {
              await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } catch {}
          } else if (payload.type === "end-call") {
            cleanUpCall();
            toast.info("أغلق الطرف الآخر المكالمة");
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(callChannel);
    };
  }, [matchId]);

  // إعداد اتصال WebRTC الأصلي
  const createPeerConnection = () => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (event) => {
      if (event.candidate && callChannelRef.current) {
        callChannelRef.current.send({
          type: "broadcast",
          event: "webrtc-signal",
          payload: { type: "candidate", candidate: event.candidate },
        });
      }
    };

    pc.ontrack = (event) => {
      if (remoteAudioRef.current && event.streams[0]) {
        remoteAudioRef.current.srcObject = event.streams[0];
        remoteAudioRef.current.play().catch(() => {});
        setCallStatus("المكالمة متصلة - الصوت يعمل 🔊");
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  // بدء مكالمة مجانية
  const startVoiceCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const pc = createPeerConnection();
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      callChannelRef.current?.send({
        type: "broadcast",
        event: "webrtc-signal",
        payload: { type: "offer", offer },
      });

      setInCall(true);
      setCallStatus("جاري الاتصال بالربع...");
      toast.success("تم إرسال دعوة الاتصال");
    } catch {
      toast.error("تعذر الوصول للميكروفون لبدء المكالمة");
    }
  };

  // الرد على مكالمة واردة
  const handleIncomingCall = async (offer) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const pc = createPeerConnection();
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      callChannelRef.current?.send({
        type: "broadcast",
        event: "webrtc-signal",
        payload: { type: "answer", answer },
      });

      setInCall(true);
      setCallStatus("متصل باللاعب الآخر 🎙️");
      toast.info("تم الاتصال بالمكالمة الصوتية");
    } catch {
      toast.error("تعذر فتح الميكروفون للرد");
    }
  };

  const cleanUpCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setInCall(false);
  };

  const endVoiceCall = () => {
    callChannelRef.current?.send({
      type: "broadcast",
      event: "webrtc-signal",
      payload: { type: "end-call" },
    });
    cleanUpCall();
    toast.info("تم إنهاء المكالمة");
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // تسجيل البصمات الصوتية
  const recordAudio = async () => {
    if (recording && recorderRef.current) {
      recorderRef.current.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("التسجيل الصوتي غير مدعوم في هذا المتصفح");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => event.data.size && audioChunksRef.current.push(event.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type });
        setSending(true);
        try {
          const attachment = await uploadChatAttachment(file);
          await sendMessage({ matchId, body: "تسجيل صوتي 🎙️", attachment });
          toast.success("تم إرسال التسجيل الصوتي");
          await messagesState.reload();
        } catch (error) {
          toast.error(error?.message || "تعذر إرسال التسجيل الصوتي");
        } finally {
          setSending(false);
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      recorder.addEventListener("stop", () => {
        recorderRef.current = null;
        setRecording(false);
      }, { once: true });
    } catch (error) {
      toast.error(error?.message || "تعذر الوصول إلى الميكروفون");
    }
  };

  const handleAttachment = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSending(true);
    try {
      const attachment = await uploadChatAttachment(file);
      await sendMessage({ matchId, body: file.name, attachment });
      toast.success("تم إرسال المرفق");
      await messagesState.reload();
    } catch (error) {
      toast.error(error?.message || "تعذر إرسال المرفق حالياً");
    } finally {
      setSending(false);
      event.target.value = "";
    }
  };

  const handleSend = async () => {
    const body = messageText.trim();
    if (!body) return;
    setSending(true);
    try {
      await sendMessage({ matchId, body });
      setMessageText("");
      await messagesState.reload();
    } catch (error) {
      toast.error(error?.message || "حدث خطأ في الإرسال");
    } finally {
      setSending(false);
    }
  };

  return (
    <PhoneShell withNav>
      <StatusBar />
      {/* عنصر تشغيل صوت الطرف الآخر بشكل مخفي */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* الترويسة العلوية */}
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => toast.info("دعوة الربع إلى الشات")}
            aria-label="إضافة لاعب"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-foreground active:scale-95 transition-transform"
          >
            <UserPlus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={startVoiceCall}
            aria-label="اتصال صوتي"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-primary/10 text-primary active:scale-95 transition-transform"
          >
            <Phone className="h-4 w-4" />
          </button>
        </div>

        <div className="text-center">
          <h2 className="text-base font-extrabold text-foreground">الدردشة</h2>
          <p className="text-[11px] text-primary font-medium">{matchName}</p>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle className="h-9 w-9" />
          <button
            type="button"
            onClick={() => toast.info(`القناة الحالية: ${matchName}`)}
            aria-label="معلومات"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-foreground"
          >
            <Info className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* شريط المكالمة الصوتية المباشرة */}
      {inCall && (
        <div className="p-4 bg-primary/10 border-b border-primary/20 flex items-center justify-between animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3">
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">مكالمة صوتية حية</p>
              <p className="text-[10px] text-muted-foreground">{callStatus}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              className={`p-2 rounded-full text-white ${isMuted ? "bg-amber-600" : "bg-slate-700"}`}
            >
              {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={endVoiceCall}
              className="p-2 rounded-full bg-rose-600 text-white"
            >
              <PhoneOff className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* قائمة الرسائل */}
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 no-scrollbar">
        <RemoteState {...messagesState} empty={!messages.length}>
          <>
            {messages.map((message, index) => {
              // توحيد قراءة الحقول بغض النظر عن مسمى العمود في قاعدة البيانات
              const textContent = message.text || message.body || message.content;
              const authorName = message.author || message.sender_id || message.user_id || "لاعب";
              const mediaUrl = message.attachmentUrl || message.media_url;
              const mediaType = message.messageType || message.media_type;
              const formattedTime = message.time || (message.created_at ? new Date(message.created_at).toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" }) : "الآن");

              return (
                <div
                  key={message.id || index}
                  className={`flex items-end gap-2 ${message.mine ? "flex-row" : "flex-row-reverse"}`}
                >
                  {!message.mine ? <Avatar name={authorName} size="h-8 w-8" /> : null}
                  <div className={message.mine ? "text-left" : "text-right"}>
                    {!message.mine ? (
                      <p className="pb-1 text-[11px] text-muted-foreground">{authorName}</p>
                    ) : null}
                    <div
                      className={`max-w-[15rem] rounded-2xl px-3.5 py-2.5 text-sm ${
                        message.mine
                          ? "bg-gradient-primary text-primary-foreground"
                          : "border border-border bg-surface text-foreground"
                      }`}
                    >
                      {mediaType === "image" && mediaUrl ? (
                        <img
                          src={mediaUrl}
                          alt={message.attachmentName || "مرفق"}
                          className="mb-2 max-h-48 rounded-xl object-cover"
                        />
                      ) : null}
                      {mediaUrl && mediaType !== "image" ? (
                        <a
                          href={mediaUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mb-1 block underline"
                        >
                          {message.attachmentName || "فتح المرفق"}
                        </a>
                      ) : null}
                      {textContent ? <span>{textContent}</span> : null}
                    </div>
                    <p className="pt-1 text-[10px] text-muted-foreground">{formattedTime}</p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        </RemoteState>

        {/* مساعد جوك */}
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3.5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Bot className="h-5 w-5" />
            </div>
            <div className="text-right flex-1">
              <p className="text-xs font-bold text-foreground">مساعد جوك لتنسيق اللعبة</p>
              <p className="pt-1 text-[11px] leading-relaxed text-muted-foreground">
                تحتاج كمل عدد اللاعبين أو تستفسر عن قوانين الحجز والملاعب؟ أنا بضهرك.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMessageText("يا بوت كملنا العدد ناقصنا لاعبين")}
            className="mt-2.5 w-full rounded-xl bg-surface border border-border py-2 text-xs font-semibold text-foreground hover:bg-surface-2 transition-colors"
          >
            طلب فزعة لاعبين ⚽
          </button>
        </div>
      </div>

      {/* الملصقات */}
      {stickersOpen ? (
        <div className="flex gap-2 border-t border-border px-4 py-2 bg-surface" dir="rtl">
          {["⚽", "🔥", "👏", "😂", "💪", "🙌", "🚩", "🏆"].map((sticker) => (
            <button
              key={sticker}
              type="button"
              onClick={() => setMessageText((value) => `${value}${sticker}`)}
              className="text-lg hover:scale-125 transition-transform"
            >
              {sticker}
            </button>
          ))}
        </div>
      ) : null}

      {/* شريط الأدوات والإرسال */}
      <div className="flex items-center gap-2 border-t border-border px-4 py-3 bg-surface">
        <button
          type="button"
          onClick={recordAudio}
          aria-label="تسجيل صوتي"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground ${
            recording ? "animate-pulse ring-2 ring-rose-500" : ""
          }`}
        >
          <Mic className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setStickersOpen((value) => !value)}
          aria-label="ملصقات"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground"
        >
          <Smile className="h-4 w-4" />
        </button>
        <div className="flex flex-1 items-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 shadow-inner">
          <input
            value={messageText}
            onChange={(event) => setMessageText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleSend();
            }}
            placeholder="اكتب رسالتك للربع.."
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={sending}
            aria-label="إرسال"
            className="text-primary disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <input
          id="chat-attachment"
          type="file"
          accept="image/*,.pdf,.doc,.docx,.zip"
          className="hidden"
          onChange={handleAttachment}
        />
        <button
          type="button"
          onClick={() => document.getElementById("chat-attachment")?.click()}
          aria-label="إرفاق"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </PhoneShell>
  );
}
