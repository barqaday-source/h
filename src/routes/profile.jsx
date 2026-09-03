import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Award, ChevronLeft, MapPin, Radar, Settings, SquarePen, User, Save, LogOut, Trash2, Camera } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Avatar, Card, PhoneShell, StatusBar, ThemeToggle } from "@/components/ui-kit";
import { RemoteState, useRemoteData } from "@/hooks/use-app-data";
import { fetchProfile, setPlayerPresence, updateProfile } from "@/lib/data";
import { getSession, isSupabaseConfigured, requireSupabase } from "@/lib/supabase";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "البروفايل | جَوَّك" }] }),
  component: ProfileScreen,
});

function ProfileScreen() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [sessionLoading, setSessionLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  
  const [editName, setEditName] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [presenceBusy, setPresenceBusy] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    getSession().then(({ session }) => {
      setUserId(session?.user?.id ?? "");
      setSessionLoading(false);
    });
  }, []);

  const profileState = useRemoteData(async () => {
    if (!userId) return null;
    let profile = await fetchProfile(userId);
    if (!profile) {
      const client = requireSupabase();
      const { data: { session } } = await client.auth.getSession();
      const email = session?.user?.email || "لاعب جوك";
      const defaultName = email.split("@")[0];
      await client.from("profiles").upsert({
        id: userId,
        display_name: defaultName,
        full_name: defaultName,
        city: "البصرة",
        role: "لاعب",
        status: "online",
        matches_count: 0,
        wins_count: 0,
        goals_count: 0
      }, { onConflict: "id" });
      profile = await fetchProfile(userId);
    }
    return profile;
  }, [userId]);

  const profile = profileState.data;

  const displayName = profile?.display_name || profile?.full_name || profile?.name || "لاعب جوك";
  const displayCity = profile?.city || "البصرة";
  const displayPhone = profile?.phone || "";
  const avatarUrl = profile?.avatar_url || profile?.avatar || null;
  const isPresenceActive = profile?.presence_active || profile?.presenceActive || false;

  useEffect(() => {
    if (profile) {
      setEditName(displayName);
      setEditCity(displayCity);
      setEditPhone(displayPhone);
    }
  }, [profile]);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    try {
      setUploadingImage(true);
      const client = requireSupabase();
      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await client.storage.from("profiles").upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = client.storage.from("profiles").getPublicUrl(filePath);

      await updateProfile(userId, { avatar_url: publicUrl });
      toast.success("تم تحديث صورة البروفايل بنجاح 📸");
      profileState.reload();
    } catch (err) {
      toast.error("فشل رفع الصورة: " + (err.message || "خطأ غير معروف"));
    } finally {
      setUploadingImage(false);
    }
  };

  const toggleJawkPresence = async () => {
    if (!userId || !profile) return;
    const nextActive = !isPresenceActive;
    setPresenceBusy(true);
    const save = (position) =>
      setPlayerPresence({
        is_active: nextActive,
        active: nextActive,
        latitude: position?.coords?.latitude ?? null,
        longitude: position?.coords?.longitude ?? null,
      }).then(() => {
        toast.success(nextActive ? "جمجم يعرف أنك متاح الآن ⚡" : "تم إيقاف استقبال طلبات جمجم");
        profileState.reload();
      }).catch((e) => toast.error(e.message)).finally(() => setPresenceBusy(false));

    if (nextActive && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(save, () => save(null), { maximumAge: 300000, timeout: 8000 });
    } else {
      save(null);
    }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) { toast.error("الاسم مطلوب"); return; }
    try {
      await updateProfile(userId, { 
        display_name: editName.trim(), 
        full_name: editName.trim(), 
        city: editCity.trim() || "البصرة",
        phone: editPhone.trim()
      });
      toast.success("تم حفظ البروفايل بنجاح ⚽");
      setEditing(false);
      profileState.reload();
    } catch (e) { toast.error(e.message); }
  };

  const logout = async () => {
    try { 
      await requireSupabase().auth.signOut(); 
      toast.success("تم تسجيل الخروج بنجاح"); 
      navigate({ to: "/auth" }); 
    } catch (e) { 
      toast.error(e.message); 
    }
  };

  const deleteAccount = async () => {
    if (!window.confirm("هل أنت متأكد من رغبتك في حذف الحساب نهائياً؟")) return;
    try {
      const client = requireSupabase();
      await client.from("profiles").delete().eq("id", userId);
      await client.auth.signOut();
      toast.success("تم حذف الحساب بنجاح");
      navigate({ to: "/auth" });
    } catch (e) {
      toast.error("فشل حذف الحساب: " + e.message);
    }
  };

  if (sessionLoading) return <PhoneShell><StatusBar /><RemoteState loading /></PhoneShell>;
  if (!isSupabaseConfigured || !userId) return (
    <PhoneShell><StatusBar />
      <div className="px-5 pt-16 text-center bg-white dark:bg-[#041c14] h-full">
        <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">سجّل دخولك أولاً لربط حسابك</h2>
        <Link to="/auth" className="mt-6 block rounded-2xl bg-emerald-500 py-3.5 text-sm font-bold text-slate-900">الانتقال للتسجيل</Link>
      </div>
    </PhoneShell>
  );

  return (
    <PhoneShell withNav>
      <StatusBar />
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-[#0d3b2c] bg-white dark:bg-[#041c14] text-slate-900 dark:text-white transition-colors">
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button type="button" onClick={() => setEditing(v => !v)} className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 dark:border-[#0d3b2c] bg-slate-100 dark:bg-[#072c20] text-emerald-600 dark:text-emerald-400 cursor-pointer" title="الإعدادات">
            <Settings className="h-4.5 w-4.5" />
          </button>
        </div>
        <h2 className="text-lg font-extrabold">البروفايل</h2>
        <button type="button" onClick={() => setEditing(v => !v)} className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 dark:border-[#0d3b2c] bg-slate-100 dark:bg-[#072c20] text-emerald-600 dark:text-emerald-400 cursor-pointer">
          <SquarePen className="h-4.5 w-4.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#041c14] pb-10 text-slate-900 dark:text-white transition-colors">
        <RemoteState {...profileState} empty={!profile}>
          <>
            {profile ? (
              <>
                <div className="flex flex-col items-center gap-2 pt-4">
                  <div className="relative group">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={displayName} className="h-20 w-20 rounded-full object-cover border-2 border-emerald-500" />
                    ) : (
                      <Avatar name={displayName} size="h-20 w-20" online ring />
                    )}
                    <label className="absolute bottom-0 left-0 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-slate-900 dark:text-[#032015] shadow-md cursor-pointer hover:scale-105 transition-transform">
                      <Camera className="h-3.5 w-3.5" />
                      <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" disabled={uploadingImage} />
                    </label>
                  </div>
                  <h3 className="pt-1 text-lg font-extrabold">{displayName}</h3>
                  <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400/80">
                    <MapPin className="h-3 w-3" />{displayCity}
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 dark:border-emerald-500/40 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {profile.role || "لاعب"}
                    </span>
                    <span className="rounded-full border border-slate-200 dark:border-[#0d3b2c] bg-white dark:bg-[#072c20] px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      متصل الآن
                    </span>
                  </div>
                </div>

                {editing && (
                  <div className="px-5 pt-5 space-y-3">
                    <div className="rounded-2xl border border-slate-200 dark:border-[#0d3b2c] bg-white dark:bg-[#072c20] p-4 space-y-3 shadow-md">
                      <div className="flex items-center gap-2 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        <User className="h-4 w-4" /> تعديل معلومات الحساب
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-600 dark:text-emerald-400/70">الاسم الكامل</label>
                        <input 
                          value={editName} 
                          onChange={e => setEditName(e.target.value)} 
                          placeholder="الاسم" 
                          className="w-full rounded-xl border border-slate-200 dark:border-[#0d3b2c] bg-slate-50 dark:bg-[#041c14] px-4 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500" 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-600 dark:text-emerald-400/70">المدينة / المنطقة</label>
                        <input 
                          value={editCity} 
                          onChange={e => setEditCity(e.target.value)} 
                          placeholder="المدينة (مثلاً: البصرة)" 
                          className="w-full rounded-xl border border-slate-200 dark:border-[#0d3b2c] bg-slate-50 dark:bg-[#041c14] px-4 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500" 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-600 dark:text-emerald-400/70">رقم الهاتف (للتواصل وقت اللعبة)</label>
                        <input 
                          value={editPhone} 
                          onChange={e => setEditPhone(e.target.value)} 
                          placeholder="0780xxxxxxxx" 
                          dir="ltr"
                          className="w-full rounded-xl border border-slate-200 dark:border-[#0d3b2c] bg-slate-50 dark:bg-[#041c14] px-4 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 text-left" 
                        />
                      </div>
                      <button 
                        onClick={handleSaveProfile} 
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-sm font-bold text-slate-900 dark:text-[#032015] active:scale-95 transition-all cursor-pointer"
                      >
                        <Save className="h-4 w-4" /> حفظ التعديلات
                      </button>
                    </div>
                  </div>
                )}

                <div className="px-5 pt-5">
                  <Card className="flex items-center justify-between gap-3 p-3 bg-white dark:bg-[#072c20] border-slate-200 dark:border-[#0d3b2c]">
                    <button 
                      type="button" 
                      disabled={presenceBusy} 
                      onClick={toggleJawkPresence} 
                      className={`rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                        isPresenceActive 
                          ? "bg-emerald-500 text-slate-900 dark:text-[#032015]" 
                          : "border border-slate-200 dark:border-[#0d3b2c] bg-slate-50 dark:bg-[#041c14] text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {presenceBusy ? "جاري الحفظ..." : isPresenceActive ? "إيقاف" : "تفعيل"}
                    </button>
                    <div className="flex items-center gap-2 text-right">
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">جمجم</p>
                        <p className="pt-0.5 text-[11px] text-slate-500 dark:text-emerald-400/70">
                          {isPresenceActive ? "نشط لاستقبال طلبات الفرق" : "فعّل الزر ليجدك جمجم"}
                        </p>
                      </div>
                      <Radar className={`h-5 w-5 ${isPresenceActive ? "text-emerald-500 dark:text-emerald-400" : "text-emerald-400/50 dark:text-emerald-600"}`} />
                    </div>
                  </Card>
                </div>

                <div className="grid grid-cols-3 gap-3 px-5 pt-5">
                  {[
                    { id: 1, value: profile.matches_count ?? 0, label: "لعابت" },
                    { id: 2, value: profile.wins_count ?? 0, label: "فوز" },
                    { id: 3, value: profile.goals_count ?? 0, label: "هدف" }
                  ].map((stat) => (
                    <Card key={stat.id} className="p-3 text-center bg-white dark:bg-[#072c20] border-slate-200 dark:border-[#0d3b2c]">
                      <p className="text-xl font-extrabold text-slate-900 dark:text-white">{stat.value}</p>
                      <p className="pt-0.5 text-[11px] text-slate-500 dark:text-emerald-400/70">{stat.label}</p>
                    </Card>
                  ))}
                </div>

                <div className="px-5 pt-6">
                  <div className="flex items-center justify-between pb-3">
                    <ChevronLeft className="h-4 w-4 text-emerald-500/60" />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">الشارات والإنجازات</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 1, label: "في البداية", active: (profile.goals_count ?? 0) > 0 },
                      { id: 2, label: "لاعب نشط", active: (profile.matches_count ?? 0) > 0 },
                      { id: 3, label: "أول فوز", active: (profile.wins_count ?? 0) > 0 }
                    ].map((badge) => (
                      <Card key={badge.id} className={`flex flex-col items-center gap-2 p-3 text-center bg-white dark:bg-[#072c20] border-slate-200 dark:border-[#0d3b2c] ${badge.active ? "" : "opacity-40 grayscale"}`}>
                        <Award className="h-6 w-6 text-amber-500 dark:text-amber-400" />
                        <span className="text-[11px] font-semibold text-slate-700 dark:text-emerald-200">{badge.label}</span>
                      </Card>
                    ))}
                  </div>
                </div>

                <div className="px-5 pb-8 pt-6 space-y-3">
                  <Card className="divide-y divide-slate-100 dark:divide-[#0d3b2c] p-0 bg-white dark:bg-[#072c20] border-slate-200 dark:border-[#0d3b2c]">
                    <button type="button" onClick={logout} className="flex w-full items-center justify-between px-4 py-3.5 cursor-pointer">
                      <ChevronLeft className="h-4 w-4 text-slate-400 dark:text-emerald-500/60" />
                      <span className="text-sm text-slate-700 dark:text-emerald-300 font-medium flex items-center gap-2">
                        <LogOut className="h-4 w-4" /> تسجيل الخروج
                      </span>
                    </button>
                    <button type="button" onClick={deleteAccount} className="flex w-full items-center justify-between px-4 py-3.5 cursor-pointer">
                      <ChevronLeft className="h-4 w-4 text-red-500/60" />
                      <span className="text-sm text-red-500 dark:text-red-400 font-medium flex items-center gap-2">
                        <Trash2 className="h-4 w-4" /> حذف الحساب نهائياً
                      </span>
                    </button>
                  </Card>
                </div>
              </>
            ) : null}
          </>
        </RemoteState>
      </div>
    </PhoneShell>
  );
}
