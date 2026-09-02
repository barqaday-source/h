import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Award, ChevronLeft, MapPin, Radar, Settings, SquarePen, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Avatar, Card, PhoneShell, StatusBar, ThemeToggle } from "@/components/ui-kit";
import { RemoteState, useRemoteData } from "@/hooks/use-app-data";
import { fetchProfile, setPlayerPresence, updateProfile } from "@/lib/data";
import { getSession, isSupabaseConfigured, requireSupabase } from "@/lib/supabase";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "البروفايل | إحصائياتك وشاراتك في جوك" },
      { name: "description", content: "بروفايل اللاعب: عدد اللعبات، الأهداف، الشارات والإنجازات." },
    ],
  }),
  component: ProfileScreen,
});

function ProfileScreen() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [sessionLoading, setSessionLoading] = useState(true);
  useEffect(() => {
    getSession().then(({ session }) => {
      setUserId(session?.user?.id ?? "");
      setSessionLoading(false);
    });
  }, []);
  const profileState = useRemoteData(() => fetchProfile(userId), [userId]);
  const profile = profileState.data;
  const [presenceBusy, setPresenceBusy] = useState(false);

  const toggleJawkPresence = async () => {
    if (!userId || !profile) return;
    const nextActive = !profile.presenceActive;
    setPresenceBusy(true);
    const save = (position) =>
      setPlayerPresence({
        active: nextActive,
        latitude: position?.coords?.latitude ?? null,
        longitude: position?.coords?.longitude ?? null,
      })
        .then(() => {
          toast.success(nextActive ? "جمجم يعرف أنك متاح الآن" : "تم إيقاف استقبال طلبات جمجم");
          profileState.reload();
        })
        .catch((error) => toast.error(error.message))
        .finally(() => setPresenceBusy(false));
    if (nextActive && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(save, () => save(null), { maximumAge: 300000, timeout: 8000 });
    } else {
      save(null);
    }
  };

  const editProfile = async () => {
    if (!profile || !userId) return;
    const name = window.prompt("الاسم", profile.name);
    if (!name?.trim()) return;
    try {
      await updateProfile(userId, { display_name: name.trim() });
      toast.success("تم حفظ الملف الشخصي");
      profileState.reload();
    } catch (error) {
      toast.error(error.message);
    }
  };
  const logout = async () => {
    try {
      await requireSupabase().auth.signOut();
      toast.success("تم تسجيل الخروج");
      navigate({ to: "/auth" });
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (sessionLoading)
    return (
      <PhoneShell>
        <StatusBar />
        <RemoteState loading />
      </PhoneShell>
    );
  if (!isSupabaseConfigured || !userId)
    return (
      <PhoneShell>
        <StatusBar />
        <div className="px-5 pt-16 text-center">
          <h2 className="text-xl font-extrabold text-foreground">سجّل دخولك أولاً</h2>
          <p className="pt-2 text-sm text-muted-foreground">
            ستظهر إحصائياتك وشاراتك بعد تسجيل الدخول.
          </p>
          <Link
            to="/auth"
            className="mt-6 block rounded-2xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground"
          >
            الانتقال للتسجيل
          </Link>
        </div>
      </PhoneShell>
    );

  return (
    <PhoneShell withNav>
      <StatusBar />
      <div className="flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => toast.info("الإعدادات محفوظة مباشرة في Supabase")}
            aria-label="الإعدادات"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-foreground"
          >
            <Settings className="h-4.5 w-4.5" />
          </button>
        </div>
        <h2 className="text-lg font-extrabold text-foreground">البروفايل</h2>
        <button
          type="button"
          onClick={editProfile}
          aria-label="تعديل البروفايل"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-foreground"
        >
          <SquarePen className="h-4.5 w-4.5" />
        </button>
      </div>
      <RemoteState {...profileState} empty={!profile}>
        <>
          {profile ? (
            <>
              <div className="flex flex-col items-center gap-2 pt-2">
                <Avatar name={profile.name} size="h-20 w-20" online ring />
                <h3 className="pt-1 text-lg font-extrabold text-foreground">{profile.name}</h3>
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {profile.city ?? "لم تحدد المدينة"}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <span className="rounded-full bg-primary-soft px-3 py-1 text-[11px] font-bold text-primary">
                    {profile.role}
                  </span>
                  <span className="rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                    {profile.status}
                  </span>
                </div>
              </div>
              <div className="px-5 pt-5">
                <Card className="flex items-center justify-between gap-3 p-3">
                  <button
                    type="button"
                    disabled={presenceBusy}
                    onClick={toggleJawkPresence}
                    className={`rounded-xl px-3 py-2 text-[11px] font-bold ${profile.presenceActive ? "bg-gradient-primary text-primary-foreground" : "border border-border bg-surface text-muted-foreground"}`}
                  >
                    {presenceBusy ? "جاري الحفظ..." : profile.presenceActive ? "إيقاف" : "تفعيل"}
                  </button>
                  <div className="flex items-center gap-2 text-right">
                    <div>
                      <p className="text-sm font-bold text-foreground">جمجم</p>
                      <p className="pt-0.5 text-[11px] text-muted-foreground">
                        {profile.presenceActive ? "نشط لاستقبال طلبات الفرق" : "فعّل الزر ليجدك جمجم"}
                      </p>
                    </div>
                    <Radar className={`h-5 w-5 ${profile.presenceActive ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                </Card>
              </div>
              <div className="grid grid-cols-3 gap-3 px-5 pt-5">
                {profile.stats.map((stat) => (
                  <Card key={stat.id} className="p-3 text-center">
                    <p className="text-xl font-extrabold text-foreground">{stat.value}</p>
                    <p className="pt-0.5 text-[11px] text-muted-foreground">{stat.label}</p>
                  </Card>
                ))}
              </div>
              <div className="px-5 pt-6">
                <div className="flex items-center justify-between pb-3">
                  <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-bold text-foreground">الشارات والإنجازات</h3>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {profile.badges.map((badge) => (
                    <Card
                      key={badge.id}
                      className="flex flex-col items-center gap-2 p-3 text-center"
                    >
                      <Award className="h-6 w-6 text-warning" />
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        {badge.label}
                      </span>
                    </Card>
                  ))}
                </div>
              </div>
              <div className="px-5 pt-6">
                <h3 className="pb-3 text-sm font-bold text-foreground">آخر اللعبات</h3>
                <div className="space-y-2.5">
                  {profile.recentGames.map((game) => (
                    <div
                      key={game.id}
                      className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3"
                    >
                      <span className="flex items-center gap-1 text-xs font-bold text-warning">
                        <Star className="h-3.5 w-3.5 fill-current" />
                        {game.rating ?? "—"}
                      </span>
                      <span className="text-sm text-foreground">{game.pitch}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-5 pb-8 pt-6">
                <Card className="divide-y divide-border p-0">
                  <button
                    type="button"
                    onClick={() => toast.info("سجل المباريات متاح من جدول recent_games")}
                    className="flex w-full items-center justify-between px-4 py-3.5"
                  >
                    <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">سجل المباريات</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toast.info("الإحصائيات تُجلب مباشرة من player_stats")}
                    className="flex w-full items-center justify-between px-4 py-3.5"
                  >
                    <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">إحصائياتي</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toast.info("يمكن تعديل بياناتك من زر القلم")}
                    className="flex w-full items-center justify-between px-4 py-3.5"
                  >
                    <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">الإعدادات</span>
                  </button>
                  <button
                    type="button"
                    onClick={logout}
                    className="flex w-full items-center justify-between px-4 py-3.5"
                  >
                    <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-destructive">تسجيل الخروج</span>
                  </button>
                </Card>
                <Link
                  to="/summary"
                  className="mt-4 block w-full rounded-2xl border border-border bg-surface py-3 text-center text-xs font-semibold text-muted-foreground"
                >
                  عرض ملخص آخر مباراة
                </Link>
              </div>
            </>
          ) : null}
        </>
      </RemoteState>
    </PhoneShell>
  );
}
