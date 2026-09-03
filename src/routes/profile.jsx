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

  useEffect(() => {
    getSession().then(({ session }) => {
      setUserId(session?.user?.id?? "");
      setSessionLoading(false);
    });
  }, []);

  const profileState = useRemoteData(async () => {
    if (!userId) return null;
    let profile = await fetchProfile(userId);
    // اذا ماكو بروفايل انشئ واحد
    if (!profile) {
      const client = requireSupabase();
      const { data: { session } } = await client.auth.getSession();
      const email = session?.user?.email || "لاعب جوك";
      await client.from("profiles").upsert({
        id: userId,
        display_name: email.split("@")[0],
        full_name: email.split("@")[0],
        city: "البصرة",
        role: "player",
        status: "online"
      }, { onConflict: "id" });
      profile = await fetchProfile(userId);
    }
    return profile;
  }, [userId]);

  const profile = profileState.data;
  const [presenceBusy, setPresenceBusy] = useState(false);

  useEffect(() => {
    if (profile) {
      setEditName(profile.name || "");
      setEditCity(profile.city || "");
    }
  }, [profile]);

  const toggleJawkPresence = async () => {
    if (!userId ||!profile) return;
    const nextActive =!profile.presenceActive;
    setPresenceBusy(true);
    const save = (position) =>
      setPlayerPresence({
        active: nextActive,
        latitude: position?.coords?.latitude?? null,
        longitude: position?.coords?.longitude?? null,
      }).then(() => {
        toast.success(nextActive? "جمجم يعرف أنك متاح الآن" : "تم إيقاف استقبال طلبات جمجم");
        profileState.reload();
      }).catch((e) => toast.error(e.message)).finally(() => setPresenceBusy(false));
    if (nextActive && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(save, () => save(null), { maximumAge: 300000, timeout: 8000 });
    } else save(null);
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
    try { await requireSupabase().auth.signOut(); toast.success("تم تسجيل الخروج"); navigate({ to: "/auth" }); } catch (e) { toast.error(e.message); }
  };

  if (sessionLoading) return <PhoneShell><StatusBar /><RemoteState loading /></PhoneShell>;
  if (!isSupabaseConfigured ||!userId) return (
    <PhoneShell><StatusBar />
      <div className="px-5 pt-16 text-center">
        <h2 className="text-xl font-extrabold">سجّل دخولك أولاً</h2>
        <Link to="/auth" className="mt-6 block rounded-2xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground">الانتقال للتسجيل</Link>
      </div>
    </PhoneShell>
  );

  return (
    <PhoneShell withNav>
      <StatusBar />
      <div className="flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-2"><ThemeToggle />
          <button type="button" onClick={() => toast.info("الإعدادات محفوظة مباشرة")} className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface"><Settings className="h-4.5 w-4.5" /></button>
        </div>
        <h2 className="text-lg font-extrabold">البروفايل</h2>
        <button type="button" onClick={() => setEditing(v =>!v)} className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface"><SquarePen className="h-4.5 w-4.5" /></button>
      </div>

      <RemoteState {...profileState} empty={!profile}>
        <>
          {profile? (
            <>
              <div className="flex flex-col items-center gap-2 pt-2">
                <Avatar name={profile.name} size="h-20 w-20" online ring />
                <h3 className="pt-1 text-lg font-extrabold">{profile.name}</h3>
                <p className="flex items-center gap-1 text- text-muted-foreground"><MapPin className="h-3 w-3" />{profile.city?? "البصرة"}</p>
                <div className="flex items-center gap-2 pt-1">
                  <span className="rounded-full bg-primary-soft px-3 py-1 text- font-bold text-primary">{profile.role}</span>
                  <span className="rounded-full border border-border bg-surface px-3 py-1 text- font-semibold text-muted-foreground">{profile.status}</span>
                </div>
              </div>

              {editing && (
                <div className="px-5 pt-5 space-y-3">
                  <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-bold"><User className="h-4 w-4" />تعديل البروفايل</div>
                    <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="الاسم" className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none" />
                    <input value={editCity} onChange={e => setEditCity(e.target.value)} placeholder="المدينة" className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none" />
                    <button onClick={handleSaveProfile} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary py-2.5 text-sm font-bold text-primary-foreground"><Save className="h-4 w-4" />حفظ</button>
                  </div>
                </div>
              )}

              <div className="px-5 pt-5"><Card className="flex items-center justify-between gap-3 p-3">
                <button type="button" disabled={presenceBusy} onClick={toggleJawkPresence} className={`rounded-xl px-3 py-2 text- font-bold ${profile.presenceActive? "bg-gradient-primary text-primary-foreground" : "border border-border bg-surface text-muted-foreground"}`}>{presenceBusy? "جاري الحفظ..." : profile.presenceActive? "إيقاف" : "تفعيل"}</button>
                <div className="flex items-center gap-2 text-right"><div><p className="text-sm font-bold">جمجم</p><p className="pt-0.5 text- text-muted-foreground">{profile.presenceActive? "نشط لاستقبال طلبات الفرق" : "فعّل الزر ليجدك جمجم"}</p></div><Radar className={`h-5 w-5 ${profile.presenceActive? "text-primary" : "text-muted-foreground"}`} /></div>
              </Card></div>

              <div className="grid grid-cols-3 gap-3 px-5 pt-5">{profile.stats.map((stat) => (<Card key={stat.id} className="p-3 text-center"><p className="text-xl font-extrabold">{stat.value}</p><p className="pt-0.5 text- text-muted-foreground">{stat.label}</p></Card>))}</div>

              <div className="px-5 pt-6"><div className="flex items-center justify-between pb-3"><ChevronLeft className="h-4 w-4 text-muted-foreground" /><h3 className="text-sm font-bold">الشارات والإنجازات</h3></div><div className="grid grid-cols-3 gap-3">{profile.badges.map((badge) => (<Card key={badge.id} className="flex flex-col items-center gap-2 p-3 text-center"><Award className="h-6 w-6 text-warning" /><span className="text- font-semibold text-muted-foreground">{badge.label}</span></Card>))}</div></div>

              <div className="px-5 pb-8 pt-6"><Card className="divide-y divide-border p-0">
                <button type="button" onClick={logout} className="flex w-full items-center justify-between px-4 py-3.5"><ChevronLeft className="h-4 w-4 text-muted-foreground" /><span className="text-sm text-destructive">تسجيل الخروج</span></button>
              </Card><Link to="/summary" className="mt-4 block w-full rounded-2xl border border-border bg-surface py-3 text-center text-xs font-semibold text-muted-foreground">عرض ملخص آخر مباراة</Link></div>
            </>
          ) : null}
        </>
      </RemoteState>
    </PhoneShell>
  );
}
