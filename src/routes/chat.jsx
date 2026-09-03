import React, { useState } from "react";
import { Send, Dumbbell, Flame, HeartPulse, Sparkles } from "lucide-react";
import { PhoneShell, StatusBar, ThemeToggle } from "@/components/ui-kit";
import { toast } from "sonner";

export default function CoachAssistantScreen() {
  const [inputMessage, setInputMessage] = useState("");
  const [messages, setMessages] = useState([
    { sender: "bot", text: "أهلاً بك يا بطل! 🔥 ما هو هدفنا الرياضي اليوم؟ اختر من الخيارات الجاهزة في الأسفل أو اكتب سؤالك." },
    { 
      sender: "bot", 
      type: "card", 
      title: "تمارين الجزء العلوي (Chest & Triceps)", 
      subtitle: "المحتوى: 4 جولات × 12 تكرار",
      badge: "تمرين مقترح لك اليوم 🏋️‍♂️" 
    }
  ]);

  const handleSend = () => {
    if (!inputMessage.trim()) return;
    const newMsg = inputMessage;
    setMessages(prev => [...prev, { sender: "user", text: newMsg }]);
    setInputMessage("");

    // محاكاة رد الكوتش
    setTimeout(() => {
      setMessages(prev => [...prev, { sender: "bot", text: `كوتش AI: استمر يا بطل، بخصوص "${newMsg}" أنصحك بالالتزام بالجدول وتركيز الجهد صح! 💪` }]);
    }, 1000);
  };

  const handleQuickOption = (text) => {
    setInputMessage(text);
  };

  return (
    <PhoneShell withNav>
      <StatusBar />
      
      {/* رأس الشات الرياضي */}
      <div dir="rtl" className="flex items-center justify-between border-b border-[#29292e] bg-[#1a1a1e] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative flex h-3 w-3 items-center justify-center">
            <div className="absolute h-3 w-3 animate-ping rounded-full bg-[#00ff66] opacity-75"></div>
            <div className="h-3 w-3 rounded-full bg-[#00ff66] shadow-[0_0_10px_#00ff66]"></div>
          </div>
          <div>
            <h4 className="m-0 text-sm font-bold text-white">الكوتش المساعد AI</h4>
            <span className="text-[11px] text-[#a1a1aa]">جاهز لتنظيم تمارينك اليومية</span>
          </div>
        </div>
        <ThemeToggle className="h-9 w-9 rounded-full border border-[#29292e] bg-[#202024]" />
      </div>

      {/* جسم المحادثة */}
      <div dir="rtl" className="flex flex-1 flex-col gap-3.5 overflow-y-auto bg-[#121214] p-4 font-sans text-white">
        {messages.map((m, idx) => (
          <div key={idx} className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}>
            {m.type === "card" ? (
              <div className="w-[85%] overflow-hidden rounded-2xl border border-[#ff4500] bg-[#202024] shadow-lg">
                <div className="bg-[#ff4500] px-4 py-1.5 text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> {m.badge}
                </div>
                <div className="p-4">
                  <h5 className="mb-1 text-sm font-bold text-white">{m.title}</h5>
                  <p className="m-0 text-xs text-[#a1a1aa]">{m.subtitle}</p>
                  <button 
                    onClick={() => toast.success("تم فتح تفاصيل الحركات التدريبية!")}
                    className="mt-3 w-full rounded-xl bg-white py-2 text-xs font-bold text-black transition-colors hover:bg-slate-200 cursor-pointer"
                  >
                    عرض حركات التمرين
                  </button>
                </div>
              </div>
            ) : (
              <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                m.sender === "user" 
                  ? "rounded-br-sm bg-[#ff4500] text-white font-medium" 
                  : "rounded-bl-sm border border-[#29292e] bg-[#202024] text-slate-200"
              }`}>
                {m.text}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* خيارات سريعة تفاعلية */}
      <div dir="rtl" className="bg-[#121214] px-4 py-2 border-t border-[#29292e]/40">
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
          <button onClick={() => handleQuickOption("💪 جدول التضخيم")} className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#ff4500] bg-transparent px-3.5 py-1.5 text-xs font-medium text-[#ff4500] transition-colors hover:bg-[#ff4500]/10 cursor-pointer">
            <Dumbbell className="h-3.5 w-3.5" /> جدول التضخيم
          </button>
          <button onClick={() => handleQuickOption("🥗 دايت محسوب السعرات")} className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#00ffaa] bg-transparent px-3.5 py-1.5 text-xs font-medium text-[#00ffaa] transition-colors hover:bg-[#00ffaa]/10 cursor-pointer">
            <Flame className="h-3.5 w-3.5" /> دايت محسوب السعرات
          </button>
          <button onClick={() => handleQuickOption("⏱️ تمارين كارديو سريعة")} className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#a1a1aa] bg-transparent px-3.5 py-1.5 text-xs font-medium text-[#a1a1aa] transition-colors hover:bg-slate-800 cursor-pointer">
            <HeartPulse className="h-3.5 w-3.5" /> تمارين كارديو سريعة
          </button>
        </div>
      </div>

      {/* صندوق الإدخال السفلي */}
      <div dir="rtl" className="flex items-center gap-2 border-t border-[#29292e] bg-[#1a1a1e] p-3">
        <input 
          type="text" 
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="اسأل الكوتش عن التمارين أو السعرات..." 
          className="flex-1 rounded-xl border border-[#29292e] bg-[#202024] px-3.5 py-2.5 text-xs text-white outline-none placeholder:text-[#a1a1aa] focus:border-[#ff4500]" 
        />
        <button 
          onClick={handleSend}
          className="flex h-10 items-center justify-center rounded-xl bg-[#ff4500] px-4 text-xs font-bold text-white transition-opacity hover:opacity-90 cursor-pointer"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

    </PhoneShell>
  );
}
