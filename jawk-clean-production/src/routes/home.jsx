import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, Plus, Search, Zap, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import LiveMap from "@/components/LiveMap";
import {
  Avatar,
  Chip,
  Logo,
  NotificationButton,
  PhoneShell,
  StatusBar,
  ThemeToggle,
} from "@/components/ui-kit";
import { RemoteState, useRemoteData } from "@/hooks/use-app-data";
import {
  fetchHomeData,
  fetchNotifications,
  joinMatch,
  markNotificationRead,
  uploadStory,
  respondToInvitation,
} from "@/lib/data";
import { getSession, requireSupabase } from "@/lib/supabase";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "الرئيسية | خريطة الملاعب والمباريات القريبة" },
      {
        name: "description",
        content: "شاهد الملاعب القريبة منك على الخريطة، انضم للمباريات الناقصة، وتابع قصص الربع.",
      },
    ],
  }),
  component: HomeScreen,
});

function HomeScreen() {
  const [query, setQuery] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [activeFilter, setActiveFilter] = useState("nearby");
  const [storyUploading, setStoryUploading] = useState(false);
  const [selectedStory, setSelectedStory] = useState(null);

  const dataState = useRemoteData(() => fetchHomeData({ query }), [query]);
  const notificationsState = useRemoteData(fetchNotifications, []);
  const data = dataState.data ?? { stories: [], nearbyMatches: [], mapPins: [] };
  const notifications = notificationsState.data ?? [];
  const unreadCount = notifications.filter((notification) => !notification.read_at).length;

  useEffect(() => {
    getSession().then(({ session }) => setUserId(session?.user?.id ?? ""));
  }, []);

  useEffect(() => {
    if (!userId) return undefined;
    let channel;
    try {
      const client = requireSupabase();
      channel = client
        .channel(`jawk-notifications:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            toast.success(payload.new?.title || "وصل إشعار جديد من جمجم");
            notificationsState.reload();
          },
        )
        .subscribe();
      return () => {
        if (channel) client.removeChannel(channel);
      };
    } catch {
      return undefined;
    }
  }, [notificationsState.reload, userId]);

  const handleJoin = async (matchId) => {
    try {
      await joinMatch(matchId);
      toast.success("تم تسجيل انضمامك للمباراة");
      dataState.reload();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <PhoneShell withNav>
      <StatusBar />
      <div className="flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <NotificationButton
            count={unreadCount}
            onClick={() => setNotificationsOpen((open) => !open)}
          />
        </div>
        <Logo size="text-2xl" />
        <Avatar name="" size="h-10 w-10" online />
      </div>

      {notificationsOpen ? (
        <div className="relative z-20 mx-5 -mt-1 rounded-2xl border border-border bg-card p-3 shadow-card">
          <div className="flex items-center justify-between pb-2">
            <p className="text-sm font-bold text-foreground">إشعارات جمجم</p>
            <button type="button" className="text-[11px] text-muted-foreground" onClick={() => setNotificationsOpen(false)}>
              إغلاق
            </button>
          </div>
          {notifications.length ? (
            <div className="space-y-2">
              {notifications.slice(0, 4).map((notification) => (
                <div key={notification.id} className={`rounded-xl border border-border p-3 ${notification.read_at ? "bg-surface" : "bg-primary-soft"}`}>
                  <p className="text-xs font-bold text-foreground">{notification.title}</p>
                  <p className="pt-1 text-[11px] leading-relaxed text-muted-foreground">{notification.body}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-2 text-center text-[11px] text-muted-foreground">لا توجد إشعارات جديدة.</p>
          )}
        </div>
      ) : null}

      {/* قسم الستوريات بتصميم انستغرام */}
      <div className="flex gap-4 overflow-x-auto px-5 pb-2 no-scrollbar" dir="rtl">
        <label className="flex flex-col items-center gap-1.5 cursor-pointer">
          <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-primary bg-surface text-primary">
            {storyUploading ? "..." : <Plus className="h-5 w-5" />}
          </span>
          <span className="text-[11px] font-medium text-muted-foreground">أضف قصة</span>
          <input
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setStoryUploading(true);
              try {
                await uploadStory(file);
                toast.success("تم رفع القصة بنجاح");
                await dataState.reload();
              } catch (error) {
                toast.error(error?.message || "تعذر رفع القصة حالياً");
              } finally {
                setStoryUploading(false);
                event.target.value = "";
              }
            }}
          />
        </label>

        {data.stories.map((story) => {
          const imageUrl = story.image_url || story.media_url || story.url;
          return (
            <button
              key={story.id}
              type="button"
              className="flex flex-col items-center gap-1.5"
              onClick={() => setSelectedStory(story)}
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full p-[2px] bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600">
                <img
                  src={imageUrl}
                  alt={story.title || "قصة"}
                  className="h-full w-full rounded-full object-cover border border-background"
                />
              </span>
              <span className="text-[11px] text-muted-foreground truncate w-14 text-center">
                {story.title || "لاعب"}
              </span>
            </button>
          );
        })}
      </div>

      {/* نافذة عرض الستوري عند النقر */}
      {selectedStory && (
        <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-black/90 p-4">
          <button
            type="button"
            onClick={() => setSelectedStory(null)}
            className="absolute top-6 right-6 text-white p-2"
          >
            <X className="h-7 w-7" />
          </button>
          <img
            src={selectedStory.image_url || selectedStory.media_url || selectedStory.url}
            alt="القصة"
            className="max-h-[80vh] max-w-full rounded-2xl object-contain"
          />
        </div>
      )}

      <div className="px-5 pt-3">
        <label className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحث عن ملعب أو منطقة.."
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
      </div>

      <div className="flex gap-2 overflow-x-auto px-5 pt-3 no-scrollbar">
        {[
          { id: "nearby", label: "اللعبات القريبة" },
          { id: "venues", label: "ملاعب" },
          { id: "active", label: "الربع النشط" },
        ].map((filter) => (
          <button key={filter.id} type="button" onClick={() => setActiveFilter(filter.id)}>
            <Chip active={activeFilter === filter.id}>{filter.label}</Chip>
          </button>
        ))}
      </div>

      <div className="px-5 pt-4">
        <div className="relative h-80 overflow-hidden rounded-3xl border border-border">
          <LiveMap
            venues={data.mapPins}
            onVenueClick={(venue) => toast.info(venue.address || `تم اختيار ${venue.name}`)}
            onLocate={(error) => error && toast.info("يرجى السماح بتحديد الموقع من إعدادات المتصفح")}
          />
          <Link
            to="/fazaa"
            className="absolute bottom-4 left-4 flex items-center gap-1.5 rounded-full bg-gradient-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-glow"
          >
            <Zap className="h-4 w-4" />
            فزعة
          </Link>
          {data.nearbyMatches[0] ? (
            <div className="absolute bottom-4 right-4 w-56 rounded-2xl border border-border bg-card/95 p-3 backdrop-blur">
              <p className="flex items-center justify-end gap-1 text-xs font-bold text-foreground">
                {data.nearbyMatches[0].pitch}
                <MapPin className="h-3.5 w-3.5 text-primary" />
              </p>
              <p className="pt-1 text-[11px] text-muted-foreground">
                لعبة {data.nearbyMatches[0].format} • {data.nearbyMatches[0].distance}
              </p>
              <div className="flex items-center justify-between pt-2.5">
                <span className="text-[11px] text-muted-foreground">
                  {data.nearbyMatches[0].slots}
                </span>
                <button
                  type="button"
                  onClick={() => handleJoin(data.nearbyMatches[0].id)}
                  className="rounded-xl bg-gradient-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground"
                >
                  انضم
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="px-5 pb-6 pt-5">
        <h2 className="pb-3 text-sm font-bold text-foreground">مباريات قريبة منك</h2>
        <RemoteState {...dataState} empty={!data.nearbyMatches.length}>
          <div className="space-y-3">
            {data.nearbyMatches.map((match) => (
              <div
                key={match.id}
                className="flex items-center justify-between rounded-2xl border border-border bg-card p-3.5"
              >
                <button
                  type="button"
                  onClick={() => handleJoin(match.id)}
                  className="rounded-xl border border-primary px-3 py-1.5 text-[11px] font-bold text-primary"
                >
                  انضم الآن
                </button>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">{match.pitch}</p>
                  <p className="pt-0.5 text-[11px] text-primary">{match.startsIn}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {match.format} • {match.slots}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </RemoteState>
      </div>
    </PhoneShell>
  );
}
