import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, Plus, Search, Zap, X, User, Share2, Trash2 } from "lucide-react";
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
  deleteStory,
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

function getTimeAgo(dateString) {
  if (!dateString) return "الآن";
  const date = new Date(dateString);
  const now = new Date();
  const diffInMinutes = Math.floor((now - date) / (1000 * 60));

  if (diffInMinutes < 1) return "الآن";
  if (diffInMinutes < 60) return `منذ ${diffInMinutes} دقيقة`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `منذ ${diffInHours} ساعة`;
  return "منذ يوم";
}

function HomeScreen() {
  const [query, setQuery] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [activeFilter, setActiveFilter] = useState("nearby");
  const [storyUploading, setStoryUploading] = useState(false);
  const [selectedStory, setSelectedStory] = useState(null);

  const dataState = useRemoteData(() => fetchHomeData({ query }), [query]);
  const notificationsState = useRemoteData(fetchNotifications, []);
  const rawData = dataState.data ?? { stories: [], nearbyMatches: [], mapPins: [] };
  const notifications = notificationsState.data ?? [];
  const unreadCount = notifications.filter((notification) => !notification.read_at).length;

  // تصفية القصص لتعرض فقط ما تم رفعه خلال آخر 24 ساعة
  const validStories = (rawData.stories || []).filter((s) => {
    if (!s.created_at) return true;
    const createdAt = new Date(s.created_at).getTime();
    const now = new Date().getTime();
    return now - createdAt < 24 * 60 * 60 * 1000;
  });

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

  const handleShareStory = async (story) => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "قصة على جوك",
          text: `شاهد قصة ${story.title || "لاعب"} على جوك!`,
          url,
        });
      } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("تم نسخ رابط الصفحة للصلات");
    }
  };

  const handleDeleteStory = async (storyId) => {
    try {
      await deleteStory(storyId);
      toast.success("تم حذف القصة بنجاح");
      setSelectedStory(null);
      await dataState.reload();
    } catch (error) {
      toast.error("تعذر حذف القصة حالياً");
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

      {/* شريط الستوريات المؤقتة (24 ساعة) */}
      <div className="flex gap-4 overflow-x-auto px-5 pb-3 no-scrollbar" dir="rtl">
        <label className="flex flex-col items-center gap-1.5 cursor-pointer shrink-0">
          <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-primary bg-surface text-primary transition-transform active:scale-95">
            {storyUploading ? "..." : <Plus className="h-6 w-6" />}
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

        {validStories.map((story) => {
          const mediaUrl = story.media_url || story.image_url || story.url;
          const isVideo = mediaUrl?.match(/\.(mp4|webm|ogg|mov)$/i);
          return (
            <button
              key={story.id}
              type="button"
              className="flex flex-col items-center gap-1.5 shrink-0 transition-transform active:scale-95"
              onClick={() => setSelectedStory(story)}
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full p-[2px] bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 shadow-md">
                <span className="h-full w-full rounded-full border-2 border-background overflow-hidden bg-slate-900 flex items-center justify-center">
                  {isVideo ? (
                    <video src={mediaUrl} className="h-full w-full object-cover pointer-events-none" />
                  ) : mediaUrl ? (
                    <img src={mediaUrl} alt="ستوري" className="h-full w-full object-cover pointer-events-none" />
                  ) : (
                    <User className="h-6 w-6 text-muted-foreground" />
                  )}
                </span>
              </span>
              <span className="text-[11px] text-muted-foreground truncate w-16 text-center">
                {story.profiles?.full_name || story.title || "لاعب"}
              </span>
            </button>
          );
        })}
      </div>

      {/* قالب عرض القصة المطور مع وقت النشر والمشاركة والحذف وحماية التنزيل */}
      {selectedStory && (() => {
        const mediaUrl = selectedStory.media_url || selectedStory.image_url || selectedStory.url;
        const isVideo = mediaUrl?.match(/\.(mp4|webm|ogg|mov)$/i);
        const timeAgo = getTimeAgo(selectedStory.created_at);

        return (
          <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 select-none">
            <div className="relative h-[78vh] max-h-[680px] w-full max-w-sm rounded-3xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl flex flex-col justify-between">
              
              {/* الشريط العلوي: الصورة والاسم والوقت وأزرار الإجراءات */}
              <div className="absolute top-0 inset-x-0 z-20 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
                <div className="h-1 w-full bg-white/30 rounded-full overflow-hidden mb-3">
                  <div className="h-full bg-white w-full animate-pulse" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full border border-white/50 overflow-hidden bg-slate-800 flex items-center justify-center">
                      <User className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-xs font-bold text-white drop-shadow">
                        {selectedStory.profiles?.full_name || selectedStory.title || "لاعب جوك"}
                      </span>
                      <span className="text-[10px] text-slate-300">{timeAgo}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleShareStory(selectedStory)}
                      className="p-1.5 rounded-full bg-black/40 text-white hover:bg-black/70 transition"
                      title="مشاركة"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteStory(selectedStory.id)}
                      className="p-1.5 rounded-full bg-rose-600/80 text-white hover:bg-rose-700 transition"
                      title="حذف القصة"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedStory(null)}
                      className="p-1.5 rounded-full bg-black/40 text-white hover:bg-black/70 transition"
                      title="إغلاق"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* محتوى القصة المصورة/الفيديو الممنوع من الحفظ والتنزيل المباشر */}
              <div 
                className="relative h-full w-full flex items-center justify-center bg-black"
                onContextMenu={(e) => e.preventDefault()}
              >
                {isVideo ? (
                  <video
                    src={mediaUrl}
                    autoPlay
                    controlsList="nodownload"
                    className="h-full w-full object-cover pointer-events-auto"
                  />
                ) : mediaUrl ? (
                  <img
                    src={mediaUrl}
                    alt="القصة"
                    onDragStart={(e) => e.preventDefault()}
                    className="h-full w-full object-cover pointer-events-none select-none"
                  />
                ) : (
                  <p className="text-sm text-slate-400">عنصر الوسائط غير متوفر</p>
                )}
              </div>
            </div>
          </div>
        );
      })()}

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
            venues={rawData.mapPins}
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
          {rawData.nearbyMatches[0] ? (
            <div className="absolute bottom-4 right-4 w-56 rounded-2xl border border-border bg-card/95 p-3 backdrop-blur">
              <p className="flex items-center justify-end gap-1 text-xs font-bold text-foreground">
                {rawData.nearbyMatches[0].pitch}
                <MapPin className="h-3.5 w-3.5 text-primary" />
              </p>
              <p className="pt-1 text-[11px] text-muted-foreground">
                لعبة {rawData.nearbyMatches[0].format} • {rawData.nearbyMatches[0].distance}
              </p>
              <div className="flex items-center justify-between pt-2.5">
                <span className="text-[11px] text-muted-foreground">
                  {rawData.nearbyMatches[0].slots}
                </span>
                <button
                  type="button"
                  onClick={() => handleJoin(rawData.nearbyMatches[0].id)}
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
        <RemoteState {...dataState} empty={!rawData.nearbyMatches.length}>
          <div className="space-y-3">
            {rawData.nearbyMatches.map((match) => (
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
