import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Sparkles, Users, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, Card, PhoneShell, StatusBar, ThemeToggle } from "@/components/ui-kit";
import { RemoteState, useRemoteData } from "@/hooks/use-app-data";
import {
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
        content: "الفزعة الذكية تكمل الربع: بحث ذكي عن لاعبين ناقصين في ملاعب قريبة وسد النقص فوراً.",
      },
    ],
  }),
  component: FazaaScreen,
});

function FazaaScreen() {
  const dataState = useRemoteData(fetchFazaaData, []);
  const data = dataState.data ?? { fazaaRequests: [], players: [] };
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

  return (
    <PhoneShell withNav>
      <StatusBar />
      
      {/* رأس الصفحة */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
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

      <div className="space-y-5 px-5 py-4">
        {/* قسم المباريات التي تحتاج لاعبين */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">طلبات نشطة</span>
            <h3 className="text-sm font-bold text-foreground">مباريات تحتاج لاعبين الآن</h3>
          </div>
          
          <RemoteState {...dataState} empty={!data.fazaaRequests.length}>
            <div className="space-y-3">
              {data.fazaaRequests.map((request) => (
                <Card key={request.id} className="border border-border/80">
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
                      <p className="text-[11px] font-medium text-primary mt-1">{request.startsIn}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busyId === request.id}
                    onClick={() =>
                      act(request.id, () => respondToFazaa(request.id), "تم إرسال الاستجابة بنجاح")
                    }
                    className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-primary py-2.5 text-xs font-bold text-primary-foreground shadow-sm disabled:opacity-50"
                  >
                    <Zap className="h-4 w-4" />
                    {busyId === request.id ? "جاري الإرسال..." : "أرسل فزعة / استجب للنقص"}
                  </button>
                </Card>
              ))}
            </div>
          </RemoteState>
        </div>

        {/* قسم مقترحات جمجم الذكية للاعبين القريبين */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleJamjam}
              disabled={jamjamBusy}
              className="flex items-center gap-1 rounded-xl bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary transition hover:bg-primary/20 disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {jamjamBusy ? "جاري البحث..." : "ابحث بجمجم (AI)"}
            </button>
            <div className="text-right">
              <h3 className="text-sm font-bold text-foreground">لاعبون متاحون قربك</h3>
              <span className="text-[11px] text-muted-foreground">مطابقة جغرافية فورية</span>
            </div>
          </div>

          <RemoteState {...dataState} empty={!data.players.length && !jamjamPlayers.length}>
            <div className="grid grid-cols-4 gap-2.5">
              {(jamjamPlayers.length ? jamjamPlayers : data.players).slice(0, 4).map((player) => {
                const playerId = player.player_id ?? player.id;
                const playerName = player.player_name ?? player.name;
                const playerDistance = player.distance_km != null ? `${Number(player.distance_km).toFixed(1)} كم` : (player.distance ?? "قريب");
                return (
                  <div
                    key={playerId}
                    className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card p-2.5 text-center shadow-2xs"
                  >
                    <Avatar name={playerName} size="h-10 w-10" online />
                    <span className="text-[11px] font-bold text-foreground truncate w-full">{playerName}</span>
                    <span className="text-[10px] text-muted-foreground">{playerDistance}</span>
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
                          "تم إرسال الدعوة بنجاح"
                        )
                      }
                      className="w-full mt-1 rounded-lg bg-secondary py-1 text-[10px] font-bold text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
                    >
                      دعوة
                    </button>
                  </div>
                );
              })}
            </div>
          </RemoteState>
        </div>
      </div>
    </PhoneShell>
  );
}
