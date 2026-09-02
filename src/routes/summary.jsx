import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, PartyPopper, Plus, Star, TrendingUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import moment1 from "@/assets/moment-1.jpg";
import moment2 from "@/assets/moment-2.jpg";
import moment3 from "@/assets/moment-3.jpg";
import { Avatar, Card, PhoneShell, StatusBar, ThemeToggle } from "@/components/ui-kit";
import { RemoteState, useRemoteData } from "@/hooks/use-app-data";
import { fetchRatings, saveRating } from "@/lib/data";

export const Route = createFileRoute("/summary")({
  head: () => ({
    meta: [
      { title: "تمت المباراة | التقييم ولحظات اللعبة" },
      { name: "description", content: "ملخص المباراة: النتيجة، تقييم اللاعبين، ولحظات اللعبة." },
    ],
  }),
  component: SummaryScreen,
});

function SummaryScreen() {
  const matchId = import.meta.env.VITE_DEFAULT_MATCH_ID;
  const ratingsState = useRemoteData(() => fetchRatings(matchId), [matchId]);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const ratings = ratingsState.data ?? [];
  const moments = [moment1, moment2, moment3];
  const chooseRating = (playerId, value) =>
    setValues((current) => ({ ...current, [playerId]: value }));
  const saveAll = async () => {
    const entries = Object.entries(values).filter(([, value]) => value > 0);
    if (!entries.length) return toast.info("اختر تقييماً للاعب واحد على الأقل");
    setSaving(true);
    try {
      await Promise.all(
        entries.map(([playerId, value]) => saveRating({ matchId, playerId, value })),
      );
      toast.success("تم حفظ التقييمات");
      ratingsState.reload();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <PhoneShell withNav>
      <StatusBar />
      <div className="flex items-center justify-between px-5 py-3">
        <ThemeToggle />
        <div className="text-center">
          <h2 className="flex items-center justify-center gap-1.5 text-lg font-extrabold text-foreground">
            <PartyPopper className="h-4.5 w-4.5 text-primary" />
            تمت المباراة
          </h2>
          <p className="text-[11px] text-muted-foreground">المباراة الحالية</p>
        </div>
        <Link
          to="/home"
          aria-label="رجوع"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
      </div>
      <div className="flex justify-center pt-1">
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-card px-8 py-3">
          <span className="text-2xl font-extrabold text-foreground">—</span>
          <span className="text-muted-foreground">-</span>
          <span className="text-2xl font-extrabold text-primary">—</span>
        </div>
      </div>
      <div className="px-5 pt-6">
        <h3 className="pb-3 text-sm font-bold text-foreground">قيّم اللاعبين</h3>
        <RemoteState {...ratingsState} empty={!ratings.length}>
          <div className="grid grid-cols-2 gap-2">
            {ratings.map((player) => {
              const value = values[player.playerId] ?? player.value ?? 0;
              return (
                <div
                  key={player.id}
                  className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card p-2.5"
                >
                  <Avatar name={player.name} size="h-9 w-9" />
                  <span className="text-[11px] font-bold text-foreground">{player.name}</span>
                  <div className="flex items-center gap-0.5" dir="ltr">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => chooseRating(player.playerId, star)}
                        aria-label={`تقييم ${star}`}
                      >
                        <Star
                          className={`h-3.5 w-3.5 ${star <= value ? "fill-warning text-warning" : "text-muted-foreground"}`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </RemoteState>
      </div>
      <div className="px-5 pt-6">
        <h3 className="pb-3 text-sm font-bold text-foreground">لحظات اللعبة</h3>
        <div className="grid grid-cols-4 gap-2">
          {moments.map((moment, index) => (
            <div key={moment} className="h-20 overflow-hidden rounded-xl">
              <img
                src={moment}
                alt={`لحظة رقم ${index + 1} من المباراة`}
                className="h-full w-full object-cover"
              />
            </div>
          ))}
          <label className="flex h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-border bg-surface text-[11px] font-bold text-muted-foreground">
            <Plus className="h-4 w-4" />
            إضافة
            <input
              type="file"
              multiple
              accept="image/*,video/*"
              className="hidden"
              onChange={() => toast.info("ارفع الوسائط إلى bucket match-media في Supabase")}
            />
          </label>
        </div>
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          يمكن ربط الوسائط بمجلد المباراة في Storage.
        </p>
      </div>
      <div className="px-5 pt-6">
        <Card className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 rounded-xl bg-primary-soft px-3 py-2 text-sm font-bold text-primary">
            <TrendingUp className="h-4 w-4" />—
          </span>
          <div className="text-right">
            <p className="text-sm font-bold text-foreground">إحصائياتك بعد المباراة</p>
            <p className="pt-0.5 text-[11px] text-muted-foreground">ستظهر بعد حفظ التقييمات</p>
          </div>
        </Card>
      </div>
      <div className="px-5 pb-8 pt-5">
        <button
          type="button"
          disabled={saving}
          onClick={saveAll}
          className="w-full rounded-2xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50"
        >
          {saving ? "جاري الحفظ..." : "حفظ التقييم"}
        </button>
      </div>
    </PhoneShell>
  );
}
