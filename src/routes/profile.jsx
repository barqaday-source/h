import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Award, ChevronLeft, MapPin, Radar, Settings, SquarePen, Star, User, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Avatar, Card, PhoneShell, StatusBar, ThemeToggle } from "@/components/ui-kit";
import { RemoteState, useRemoteData } from "@/hooks/use-app-data";
import { fetchProfile, setPlayerPresence, updateProfile } from "@/lib/data";
import { getSession, isSupabaseConfigured, requireSupabase } from "@/lib/supabase";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "البروفايل | جوك" }] }),
  component: ProfileScreen,
});

function ProfileScreen() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [sessionLoading, setSessionLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCity, setEditCity] = useState("");
  const [presenceBusy, setPresenceBusy] = useState(false);

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
        role: "player",
        status: "online"
      }, { onConflict: "id" });
      profile = await fetchProfile(userId);
    }
    return profile;
  }, [userId]);

  const profile = profileState.data;

  // استخراج الاسم والمدينة بشكل آمن بغض النظر عن اسم الحقل في قاعدة البيانات
  const displayName = profile?.display_name || profile?.full_name || profile?.name || "لاعب جوك";
  const displayCity = profile?.city || "البصرة";
  const isPresenceActive = profile?.presence_active || profile?.presenceActive || false;

  useEffect(() => {
    if (profile) {
      setEditName(displayName);
      setEditCity(displayCity);
    }
  }, [profile]);

  const toggleJawkPresence = async () => {
    if (!userId || !profile) return;
    const nextActive = !isPresenceActive;
    setPresenceBusy(true);
    const save = (position) =>
      setPlayerPresence({
        active: nextActive,
        latitude: position?.coords?.latitude ?? null,
        longitude: position?.coords?.longitude ?? null,
      }).then(() => {
        toast.success(nextActive ? "جمجم يعرف أنك متاح الآن" : "تم إيقاف استقبال طلبات جمجم");
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
      await updateProfile(userId, { display_name: editName.trim(), full_name: editName.trim(), city: editCity.trim() || "البصرة" });
      toast.success("تم حفظ البروفايل");
      setEditing(false);
      profileState.reload();
    } catch (e) { toast.error(e.message); }
  };

  const logout = async () => {
    try { 
      await requireSupabase().auth.signOut(); 
      toast.success("تم تسجيل الخروج"); 
      navigate({ to: "/auth" }); 
    } catch (e) { 
      toast.error(e.message); 
    }
  };

  if (sessionLoading) return <PhoneShell><StatusBar /><RemoteState loading /></PhoneShell>;
  if (!isSupabaseConfigured || !userId) return (
    <PhoneShell><StatusBar />
      <div className="px-5 pt-16 text-center">
        <h2 className="text-xl font-extrabold text-white">سجّل دخولك أولاً</h2>
        <Link to="/auth" className="mt-6 block rounded-2xl bg-emerald-500 py-3.5 text-sm font-bold text-slate-900">الانتقال للتسجيل</Link>
      </div>
    </PhoneShell>
  );

  return (
    <PhoneShell withNav>
      <StatusBar />
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#0d3b2c] bg-[#041c14] text-white">
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button type="button" onClick={() => toast.info("الإعدادات محفوظة مباشرة")} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#0d3b2c] bg-[#072c20] text-emerald-400">
            <Settings className="h-4.5 w-4.5" />
          </button>
        </div>
        <h2 className="text-lg font-extrabold">البروفايل</h2>
        <button type="button" onClick={() => setEditing(v => !v)} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#0d3b2c] bg-[#072c20] text-emerald-400">
          <SquarePen className="h-4.5 w-4.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#041c14] pb-10 text-white">
        <RemoteState {...profileState} empty={!profile}>
          <>
            {profile ? (
              <>
                <div className="flex flex-col items-center gap-2 pt-4">
                  <Avatar name={displayName} size="h-20 w-20" online ring />
                  <h3 className="pt-1 text-lg font-extrabold">{displayName}</h3>
                  <p className="flex items-center gap-1 text-xs text-emerald-400/80">
                    <MapPin className="h-3 w-3" />{displayCity}
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 text-xs font-bold text-emerald-400">
                      {profile.role || "لاعب"}
                    </span>
                    <span className="rounded-full border border-[#0d3b2c] bg-[#072c20] px-3 py-1 text-xs font-semibold text-emerald-300">
                      {profile.status || "online"}
                    </span>
                  </div>
                </div>

                {editing && (
                  <div className="px-5 pt-5 space-y-3">
                    <div className="rounded-2xl border border-[#0d3b2c] bg-[#072c20] p-4 space-y-3 shadow-md">
                      <div className="flex items-center gap-2 text-sm font-bold text-emerald-400">
                        <User className="h-4 w-4" />تعديل البروفايل
                      </div>
                      <input 
                        value={editName} 
                        onChange={e => setEditName(e.target.value)} 
                        placeholder="الاسم" 
                        className="w-full rounded-xl border border-[#0d3b2c] bg-[#041c14] px-4 py-2.5 text-sm text-white outline-none focus:border-emerald-500" 
                      />
                      <input 
                        value={editCity} 
                        onChange={e => setEditCity(e.target.value)} 
                        placeholder="المدينة" 
                        className="w-full rounded-xl border border-[#0d3b2c] bg-[#041c14] px-4 py-2.5 text-sm text-white outline-none focus:border-emerald-500" 
                      />
                      <button 
                        onClick={handleSaveProfile} 
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-sm font-bold text-[#032015] active:scale-95 transition-all"
                      >
                        <Save className="h-4 w-4" />حفظ
                      </button>
                    </div>
                  </div>
                )}

                <div className="px-5 pt-5">
                  <Card className="flex items-center justify-between gap-3 p-3 bg-[#072c20] border-[#0d3b2c]">
                    <button 
                      type="button" 
                      disabled={presenceBusy} 
                      onClick={toggleJawkPresence} 
                      className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                        isPresenceActive 
                          ? "bg-emerald-500 text-[#032015]" 
                          : "border border-[#0d3b2c] bg-[#041c14] text-emerald-400"
                      }`}
                    >
                      {presenceBusy ? "جاري الحفظ..." : isPresenceActive ? "إيقاف" : "تفعيل"}
                    </button>
                    <div className="flex items-center gap-2 text-right">
                      <div>
                        <p className="text-sm font-bold text-white">جمجم</p>
                        <p className="pt-0.5 text-[11px] text-emerald-400/70">
                          {isPresenceActive ? "نشط لاستقبال طلبات الفرق" : "فعّل الزر ليجدك جمجم"}
                        </p>
                      </div>
                      <Radar className={`h-5 w-5 ${isPresenceActive ? "text-emerald-400" : "text-emerald-600"}`} />
                    </div>
                  </Card>
                </div>

                <div className="grid grid-cols-3 gap-3 px-5 pt-5">
                  {(profile.stats || [
                    { id: 1, value: "87", label: "لعابت" },
                    { id: 2, value: "42", label: "فوز" },
                    { id: 3, value: "118", label: "هدف" }
                  ]).map((stat) => (
                    <Card key={stat.id || stat.label} className="p-3 text-center bg-[#072c20] border-[#0d3b2c]">
                      <p className="text-xl font-extrabold text-white">{stat.value}</p>
                      <p className="pt-0.5 text-[11px] text-emerald-400/70">{stat.label}</p>
                    </Card>
                  ))}
                </div>

                <div className="px-5 pt-6">
                  <div className="flex items-center justify-between pb-3">
                    <ChevronLeft className="h-4 w-4 text-emerald-500/60" />
                    <h3 className="text-sm font-bold text-white">الشارات والإنجازات</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {(profile.badges || [
                      { id: 1, label: "هداف الحي" },
                      { id: 2, label: "تحدي مستمر" },
                      { id: 3, label: "نجم اللعبات" }
                    ]).map((badge) => (
                      <Card key={badge.id || badge.label} className="flex flex-col items-center gap-2 p-3 text-center bg-[#072c20] border-[#0d3b2c]">
                        <Award className="h-6 w-6 text-amber-400" />
                        <span className="text-[11px] font-semibold text-emerald-200">{badge.label}</span>
                      </Card>
                    ))}
                  </div>
                </div>

                <div className="px-5 pb-8 pt-6">
                  <Card className="divide-y divide-[#0d3b2c] p-0 bg-[#072c20] border-[#0d3b2c]">
                    <button type="button" onClick={logout} className="flex w-full items-center justify-between px-4 py-3.5">
                      <ChevronLeft className="h-4 w-4 text-emerald-500/60" />
                      <span className="text-sm text-red-400 font-medium">تسجيل الخروج</span>
                    </button>
                  </Card>
                  <Link to="/summary" className="mt-4 block w-full rounded-2xl border border-[#0d3b2c] bg-[#072c20] py-3 text-center text-xs font-semibold text-emerald-300 hover:bg-emerald-950/40 transition-colors">
                    عرض ملخص آخر مباراة
                  </Link>
                </div>
              </>
            ) : null}
          </>
        </RemoteState>
      </div>
    </PhoneShell>
  );
}
