import { createFileRoute } from "@tanstack/react-router";
import { Heart, MapPin, Sparkles, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, Card, PhoneShell, ProgressBar, StatusBar, ThemeToggle } from "@/components/ui-kit";
import { RemoteState, useRemoteData } from "@/hooks/use-app-data";
import {
  donate,
  fetchFazaaData,
  findPlayersWithJamJam,
  invitePlayer,
  respondToFazaa,
} from "@/lib/data";

export const Route = createFileRoute("/fazaa")({
  head: () => ({
    meta: [
      { title: "الفزعة الذكية | لاعبون ناقصون قربك" },
      {
        name: "description",
        content:
          "الفزعة الذكية تكمل الربع: لاعبون ناقصون في ملاعب قريبة واقتراحات ذكية وحملة تطوير الملاعب.",
      },
    ],
  }),
  component: FazaaScreen,
});

function FazaaScreen() {
  const dataState = useRemoteData(fetchFazaaData, []);
  const data = dataState.data ?? { fazaaRequests: [], players: [], campaign: null };
  const [busyId, setBusyId] = useState("");
  const [jamjamPlayers, setJamjamPlayers] = useState([]);
  const [jamjamBusy, setJamjamBusy] = useState(false);
  const act = async (id, action, success) => {
    setBusyId(id);
    try {
      await action();
      toast.success(success);
      dataState.reload();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusyId("");
    }
  };
  const handleJamjam = async () => {
    const matchId = data.fazaaRequests[0]?.match_id;
    if (!matchId) {
      toast.info("أنشئ مباراة ناقصة أولاً ليبحث جمجم عن لاعبين");
      return;
    }
    setJamjamBusy(true);
    try {
      const players = await findPlayersWithJamJam({ matchId, maxDistanceKm: 10, limit: 8 });
      setJamjamPlayers(players);
      toast.success(players.length ? `وجد جمجم ${players.length} لاعبين مناسبين` : "لم يجد جمجم لاعبين نشطين الآن");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setJamjamBusy(false);
    }
  };

  const handleDonate = () => {
    if (!data.campaign) return;
    const amount = Number(window.prompt("أدخل مبلغ التبرع بالدينار العراقي"));
    if (!Number.isFinite(amount) || amount <= 0) return;
    act(
      data.campaign.id,
      () => donate({ campaignId: data.campaign.id, amount }),
      "شكراً لمساهمتك في تطوير الملاعب",
    );
  };

  return (
    <PhoneShell withNav>
      <StatusBar />
      <div className="flex items-center justify-between px-5 py-3">
        <ThemeToggle />
        <div className="text-right">
          <h2 className="flex items-center justify-end gap-2 text-lg font-extrabold text-foreground">
            الفزعة الذكية
            <Sparkles className="h-4.5 w-4.5 text-primary" />
          </h2>
          <p className="text-[11px] text-muted-foreground">يلا نكمل الربع ونسوي لعبة</p>
        </div>
        <span className="rounded-xl border border-border bg-surface px-2.5 py-1 text-[11px] font-bold text-primary">
          AI
        </span>
      </div>
      <div className="space-y-3 px-5 pt-2">
        <h3 className="text-sm font-bold text-foreground">يحتاج لاعبين الآن</h3>
        <RemoteState {...dataState} empty={!data.fazaaRequests.length}>
          <>
            {data.fazaaRequests.map((request) => (
              <Card key={request.id}>
                <div className="flex items-start justify-between">
                  <div className="flex -space-x-2 space-x-reverse">
                    {data.players.slice(0, 3).map((player) => (
                      <Avatar
                        key={player.id}
                        name={player.name}
                        size="h-8 w-8"
                        online={player.online}
                      />
                    ))}
                  </div>
                  <div className="text-right">
                    <p className="flex items-center justify-end gap-1 text-sm font-bold text-foreground">
                      {request.pitch}
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                    </p>
                    <p className="pt-0.5 text-xs text-muted-foreground">{request.need}</p>
                    <p className="text-[11px] text-primary">{request.startsIn}</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busyId === request.id}
                  onClick={() =>
                    act(request.id, () => respondToFazaa(request.id), "تم إرسال الفزعة بنجاح")
                  }
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-primary py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-50"
                >
                  <Zap className="h-4 w-4" />
                  {busyId === request.id ? "جاري الإرسال..." : "أرسل فزعة"}
                </button>
              </Card>
            ))}
          </>
        </RemoteState>
      </div>
      <div className="px-5 pt-6">
        <div className="flex items-center justify-between pb-3">
          <button
            type="button"
            onClick={handleJamjam}
            disabled={jamjamBusy}
            className="rounded-xl bg-primary-soft px-3 py-1.5 text-[11px] font-bold text-primary disabled:opacity-50"
          >
            {jamjamBusy ? "جمجم يبحث..." : "ابحث بجمجم"}
          </button>
          <div className="text-right">
            <span className="text-[11px] text-muted-foreground">متاحون الآن</span>
            <h3 className="text-sm font-bold text-foreground">مقترحات جوك لك</h3>
          </div>
        </div>
        <RemoteState {...dataState} empty={!data.players.length && !jamjamPlayers.length}>
          <div className="grid grid-cols-4 gap-2">
            {(jamjamPlayers.length ? jamjamPlayers : data.players).slice(0, 4).map((player) => {
              const playerId = player.player_id ?? player.id;
              const playerName = player.player_name ?? player.name;
              const playerDistance = player.distance_km != null ? `${Number(player.distance_km).toFixed(1)} كم` : player.distance;
              return (
              <div
                key={playerId}
                className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card p-2.5"
              >
                <Avatar name={playerName} size="h-10 w-10" online />
                <span className="text-[11px] font-bold text-foreground">{playerName}</span>
                <span className="text-[10px] text-muted-foreground">{playerDistance ?? "نشط الآن"}</span>
                <button
                  type="button"
                  disabled={busyId === playerId}
                  onClick={() =>
                    act(
                      playerId,
                      () =>
                        invitePlayer({
                          matchId: data.fazaaRequests[0]?.match_id,
                          playerId,
                        }),
                      "تم إرسال الدعوة",
                    )
                  }
                  className="w-full rounded-lg bg-primary-soft py-1 text-[10px] font-bold text-primary disabled:opacity-50"
                >
                  دعوة
                </button>
              </div>
              );
            })}
          </div>
        </RemoteState>
      </div>
      <div className="px-5 pb-8 pt-6">
        <Card>
          {data.campaign ? (
            <>
              <div className="flex items-start justify-between">
                <Heart className="h-5 w-5 text-destructive" />
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">{data.campaign.title}</p>
                  <p className="pt-0.5 text-xs text-muted-foreground">{data.campaign.subtitle}</p>
                </div>
              </div>
              <div className="pt-4">
                <div className="flex items-center justify-between pb-2 text-[11px] text-muted-foreground">
                  <span>{data.campaign.progress}%</span>
                  <span>حملة تطوير الملاعب</span>
                </div>
                <ProgressBar value={data.campaign.progress} />
                <p className="pt-2 text-[11px] text-muted-foreground">
                  {data.campaign.raised} / {data.campaign.goal}
                </p>
              </div>
              <button
                type="button"
                onClick={handleDonate}
                className="mt-4 w-full rounded-xl bg-gradient-primary py-2.5 text-xs font-bold text-primary-foreground"
              >
                تبرع الآن
              </button>
            </>
          ) : (
            <p className="text-center text-xs text-muted-foreground">لا توجد حملة نشطة حالياً.</p>
          )}
        </Card>
      </div>
    </PhoneShell>
  );
}
