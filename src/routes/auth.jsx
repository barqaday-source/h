import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Flag, Hand, PersonStanding, Radar, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PhoneShell, StatusBar, ThemeToggle } from "@/components/ui-kit";
import { roles } from "@/lib/data";
import { isSupabaseConfigured, requireSupabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "انضم إلى جوك | التسجيل واختيار الدور" },
      { name: "description", content: "سجل بالبريد الإلكتروني، واختر دورك في الملاعب." },
    ],
  }),
  component: AuthScreen,
});

const roleIcons = { player: PersonStanding, keeper: Hand, referee: Flag, coach: ShieldCheck };

function AuthScreen() {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState("player");
  const [status, setStatus] = useState("available");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState("email");
  const [busy, setBusy] = useState(false);

  const continueWithEmail = () => {
    if (!email.trim()) return toast.error("أدخل بريدك الإلكتروني.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return toast.error("أدخل بريداً إلكترونياً صحيحاً.");
    setStep("password");
  };

  const submitEmailAuth = async () => {
    if (!password.trim() || password.length < 6) return toast.error("استخدم كلمة مرور من 6 أحرف على الأقل.");
    if (!isSupabaseConfigured) return toast.error("أضف إعدادات Supabase في ملف البيئة أولاً.");
    setBusy(true);
    try {
      const client = requireSupabase();
      const signUpResult = await client.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { role: selectedRole, status } },
      });
      let data = signUpResult.data;
      let error = signUpResult.error;
      if (error?.message?.toLowerCase().includes("already registered")) {
        const signInResult = await client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        data = signInResult.data;
        error = signInResult.error;
      }
      if (error) throw error;
      if (!data.user || !data.session) throw new Error("تأكيد البريد مفعّل في Supabase؛ عطّل Email Confirmations للدخول مباشرة.");
      const { error: profileError } = await client.from("profiles").upsert({ id: data.user.id, role: selectedRole, status }, { onConflict: "id" });
      if (profileError) throw profileError;
      toast.success("تم تسجيل الدخول بالبريد الإلكتروني");
      navigate({ to: "/home" });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };


  return (
    <PhoneShell>
      <StatusBar />
      <div className="flex justify-start px-5 pt-2">
        <ThemeToggle />
      </div>
      <div className="px-6 pt-4 text-center">
        <h2 className="text-2xl font-extrabold text-foreground">انضم إلى جوك</h2>
        <p className="pt-1 text-sm text-muted-foreground">دخول سريع وبدون تعقيد</p>
      </div>
      <div className="space-y-3 px-5 pt-6">
        <div className="flex items-stretch overflow-hidden rounded-2xl border border-border bg-surface">
          <button
            type="button"
            onClick={() => setStep("email")}
            className="flex flex-1 items-center justify-center gap-2 py-3.5 text-sm font-semibold text-muted-foreground"
          >
            <span className="text-base">@</span>بواسطة البريد الإلكتروني
          </button>
          <button
            type="button"
            onClick={() => setStep("email")}
            className="flex-1 border-r border-border py-3.5 text-sm font-bold text-foreground"
          >
            تسجيل بالبريد الإلكتروني
          </button>
        </div>
        {step === "email" ? (
          <>
            <label className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3.5">
              <span className="text-lg">@</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                dir="ltr"
                inputMode="email"
                placeholder="name@example.com"
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={continueWithEmail}
              className="w-full rounded-2xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50"
            >
              {busy ? "جاري المتابعة..." : "متابعة بالبريد الإلكتروني"}
            </button>
          </>
        ) : (
          <>
            <label className="flex items-center rounded-2xl border border-border bg-surface px-4 py-3.5">
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                dir="ltr"
                autoComplete="current-password"
                placeholder="أدخل كلمة المرور"
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={submitEmailAuth}
              className="w-full rounded-2xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50"
            >
              {busy ? "جاري الدخول..." : "تأكيد الدخول"}
            </button>
          </>
        )}
      </div>
      <div className="px-5 pt-7">
        <h3 className="pb-3 text-sm font-bold text-foreground">اختر دورك بالملاعب</h3>
        <div className="grid grid-cols-4 gap-2">
          {roles.map((role) => {
            const Icon = roleIcons[role.id];
            const active = selectedRole === role.id;
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => setSelectedRole(role.id)}
                className={`flex flex-col items-center gap-2 rounded-2xl border py-3 text-xs font-semibold transition-colors ${active ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-muted-foreground"}`}
              >
                <Icon className="h-5 w-5" />
                {role.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="px-5 pt-6">
        <h3 className="pb-3 text-sm font-bold text-foreground">حالتك الآن</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setStatus("available")}
            className={`rounded-2xl border py-3.5 text-sm font-semibold ${status === "available" ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-muted-foreground"}`}
          >
            متاح للعب
          </button>
          <button
            type="button"
            onClick={() => setStatus("radar")}
            className={`flex items-center justify-center gap-2 rounded-2xl border py-3.5 text-sm font-semibold ${status === "radar" ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-muted-foreground"}`}
          >
            <Radar className="h-4 w-4" />
            رادار نشط
          </button>
        </div>
        <p className="pt-3 text-center text-[11px] text-muted-foreground">
          بإمكانك تغيير الدور والحالة لاحقاً من الإعدادات
        </p>
      </div>
      <div className="mt-auto px-5 pb-10 pt-6">
        <Link
          to="/home"
          onClick={(event) => {
            event.preventDefault();
            submitEmailAuth();
          }}
          className="block w-full rounded-2xl bg-gradient-primary py-4 text-center text-sm font-bold text-primary-foreground shadow-glow"
        >
          إكمال التسجيل
        </Link>
      </div>
    </PhoneShell>
  );
}
