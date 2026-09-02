import { createFileRoute } from "@tanstack/react-router";
import { Bot, Info, Mic, Phone, Plus, Send, Smile, UserPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar, PhoneShell, StatusBar, ThemeToggle } from "@/components/ui-kit";
import { RemoteState, useRemoteData } from "@/hooks/use-app-data";
import { fetchCurrentMatchId, fetchMessages, sendMessage, uploadChatAttachment } from "@/lib/data";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "دردشة اللعبة | تنسيق المباراة مع الربع" },
      { name: "description", content: "دردشة خاصة بكل مباراة لتأكيد الحضور والتنسيق." },
    ],
  }),
  component: ChatScreen,
});

function ChatScreen() {
  const [matchId, setMatchId] = useState(import.meta.env.VITE_DEFAULT_MATCH_ID || "");
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [stickersOpen, setStickersOpen] = useState(false);
  const recorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  useEffect(() => {
    if (matchId) return;
    fetchCurrentMatchId().then(setMatchId).catch((error) => toast.error(error?.message || "تعذر العثور على مباراة نشطة"));
  }, [matchId]);
  const messagesState = useRemoteData(() => fetchMessages(matchId), [matchId]);
  const messages = messagesState.data ?? [];

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !matchId) return undefined;
    const channel = supabase
      .channel(`messages:${matchId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` },
        () => messagesState.reload(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, messagesState.reload]);

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
          if (!matchId) throw new Error("لا توجد مباراة نشطة لإرسال التسجيل.");
          const attachment = await uploadChatAttachment(file);
          await sendMessage({ matchId, body: "تسجيل صوتي", attachment });
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
      if (!matchId) throw new Error("لا توجد مباراة نشطة لإرسال المرفق.");
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
      if (!matchId) throw new Error("لا توجد مباراة نشطة لإرسال الرسالة.");
      await sendMessage({ matchId, body });
      setMessageText("");
      await messagesState.reload();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <PhoneShell withNav>
      <StatusBar />
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => toast.info("أضف لاعبين من قائمة المشاركين في المباراة")}
            aria-label="إضافة لاعب"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-foreground"
          >
            <UserPlus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => toast.info("الاتصال الصوتي سيكون متاحاً بعد تفعيل مزود المكالمات")}
            aria-label="اتصال"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-foreground"
          >
            <Phone className="h-4 w-4" />
          </button>
        </div>
        <div className="text-center">
          <h2 className="text-base font-extrabold text-foreground">دردشة اللعبة</h2>
          <p className="text-[11px] text-muted-foreground">المباراة الحالية</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle className="h-9 w-9" />
          <button
            type="button"
            onClick={() => toast.info("هذه الدردشة مرتبطة بالمباراة الحالية")}
            aria-label="معلومات"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-foreground"
          >
            <Info className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 no-scrollbar">
        <RemoteState {...messagesState} empty={!messages.length}>
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-end gap-2 ${message.mine ? "flex-row" : "flex-row-reverse"}`}
              >
                {!message.mine ? <Avatar name={message.author} size="h-8 w-8" /> : null}
                <div className={message.mine ? "text-left" : "text-right"}>
                  {!message.mine ? (
                    <p className="pb-1 text-[11px] text-muted-foreground">{message.author}</p>
                  ) : null}
                  <div
                    className={`max-w-[15rem] rounded-2xl px-3.5 py-2.5 text-sm ${message.mine ? "bg-gradient-primary text-primary-foreground" : "border border-border bg-surface text-foreground"}`}
                  >
                    {message.messageType === "image" && message.attachmentUrl ? (
                      <img src={message.attachmentUrl} alt={message.attachmentName || "مرفق"} className="mb-2 max-h-48 rounded-xl object-cover" />
                    ) : null}
                    {message.attachmentUrl && message.messageType !== "image" ? (
                      <a href={message.attachmentUrl} target="_blank" rel="noreferrer" className="mb-1 block underline">
                        {message.attachmentName || "فتح المرفق"}
                      </a>
                    ) : null}
                    {message.messageType === "text" ? message.text : null}
                  </div>
                  <p className="pt-1 text-[10px] text-muted-foreground">{message.time}</p>
                </div>
              </div>
            ))}
          </>
        </RemoteState>
        <div className="rounded-2xl border border-border bg-surface-2 p-3.5">
          <div className="flex items-start justify-between">
            <Bot className="h-5 w-5 text-primary" />
            <div className="text-right">
              <p className="text-sm font-bold text-foreground">بوت جوك</p>
              <p className="pt-1 text-xs leading-relaxed text-muted-foreground">
                تحتاج ملابس أو معدات رياضية؟ اسأل عن الملابس والمتاجر والتوصيات.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => toast.info("سيتم فتح توصيات المتاجر عند تفعيل الكتالوج")}
            className="mt-3 w-full rounded-xl bg-gradient-primary py-2 text-xs font-bold text-primary-foreground"
          >
            تسوق الآن
          </button>
        </div>
      </div>
      {stickersOpen ? (
        <div className="flex gap-2 border-t border-border px-4 py-2" dir="rtl">
          {["⚽", "🔥", "👏", "😂", "💪", "🙌"].map((sticker) => (
            <button key={sticker} type="button" onClick={() => setMessageText((value) => `${value}${sticker}`)} className="text-lg">
              {sticker}
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex items-center gap-2 border-t border-border px-4 py-3">
        <button
          type="button"
          onClick={recordAudio}
          aria-label="تسجيل صوتي"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground"
        >
            <Mic className={`h-4 w-4 ${recording ? "animate-pulse" : ""}`} />
        </button>
        <button
          type="button"
          onClick={() => setStickersOpen((value) => !value)}
          aria-label="ملصقات"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground"
        >
          <Smile className="h-4 w-4" />
        </button>
        <div className="flex flex-1 items-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5">
          <input
            value={messageText}
            onChange={(event) => setMessageText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleSend();
            }}
            placeholder="اكتب رسالة.."
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            disabled={sending}
            onClick={handleSend}
            aria-label="إرسال"
            className="text-primary disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <input id="chat-attachment" type="file" accept="image/*,.pdf,.doc,.docx,.zip" className="hidden" onChange={handleAttachment} />
        <button
          type="button"
          onClick={() => document.getElementById("chat-attachment")?.click()}
          aria-label="إرفاق"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </PhoneShell>
  );
}
