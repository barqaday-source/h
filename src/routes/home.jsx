import { createFileRoute, Link } from "@tanstack/react-router";
import {
  MapPin,
  Plus,
  Search,
  Zap,
  X,
  User,
  Share2,
  Trash2,
  Eye,
  ChevronUp,
} from "lucide-react";
import { useEffect, useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import LiveMap from "@/components/LiveMap";
import {
  Avatar,
  Chip,
  Logo,
  NotificationButton,
  PhoneShell,
  ThemeToggle,
} from "@/components/ui-kit";
import { useRemoteData } from "@/hooks/use-app-data";
import {
  fetchHomeData,
  fetchProfile,
  fetchNotifications,
  uploadStory,
  deleteStory,
  recordStoryView,
  fetchStoryViewers,
} from "@/lib/data";
import { getSession, supabase } from "@/lib/supabase";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [{ title: "الرئيسية | خريطة الملاعب والمباريات القريبة" }],
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
  const [profile, setProfile] = useState(null);
  const [activeFilter, setActiveFilter] = useState("nearby");
  const [storyUploading, setStoryUploading] = useState(false);

  const [localStories, setLocalStories] = useState([]);
  const [activeStoryGroup, setActiveStoryGroup] = useState(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [storyProgress, setStoryProgress] = useState(0);

  const [showViewersModal, setShowViewersModal] = useState(false);
  const [currentViewers, setCurrentViewers] = useState([]);
  const [loadingViewers, setLoadingViewers] = useState(false);

  const dataState = useRemoteData(() => fetchHomeData({ query }), [query]);
  const notificationsState = useRemoteData(fetchNotifications, []);
  const rawData = dataState.data ?? { stories: [], nearbyMatches: [], mapPins: [] };
  const notifications = notificationsState.data ?? [];
  const unreadCount = notifications.filter((notification) => !notification.read_at).length;

  useEffect(() => {
    getSession().then(({ session }) => {
      if (session?.user) {
        setUserId(session.user.id);
        fetchProfile(session.user.id)
          .then((data) => data && setProfile(data))
          .catch(() => {});
      }
    });
  }, []);

  useEffect(() => {
    if (rawData.stories) {
      setLocalStories(rawData.stories);
    }
  }, [rawData.stories]);

  // تحسين الأداء: تصفية وتجمّع القصص داخل useMemo
  const { myStoryGroup, otherStoryGroups } = useMemo(() => {
    const validStories = (localStories || []).filter((s) => {
      if (!s.created_at) return true;
      const createdAt = new Date(s.created_at).getTime();
      const now = Date.now();
      return now - createdAt < 24 * 60 * 60 * 1000;
    });

    const grouped = validStories.reduce((acc, story) => {
      const ownerId = story.user_id || "unknown";
      if (!acc[ownerId]) {
        acc[ownerId] = {
          userId: ownerId,
          userName: story.profiles?.full_name || story.title || "لاعب جوك",
          stories: [],
        };
      }
      acc[ownerId].stories.push(story);
      return acc;
    }, {});

    return {
      myStoryGroup: userId && grouped[userId] ? grouped[userId] : null,
      otherStoryGroups: Object.values(grouped).filter((g) => g.userId !== userId),
    };
  }, [localStories, userId]);

  const handleNextStory = useCallback(() => {
    if (!activeStoryGroup) return;
    if (activeStoryIndex < activeStoryGroup.stories.length - 1) {
      setActiveStoryIndex((prev) => prev + 1);
      setStoryProgress(0);
    } else {
      setActiveStoryGroup(null);
      setActiveStoryIndex(0);
      setStoryProgress(0);
      setShowViewersModal(false);
    }
  }, [activeStoryGroup, activeStoryIndex]);

  const handlePrevStory = useCallback(() => {
    if (activeStoryIndex > 0) {
      setActiveStoryIndex((prev) => prev - 1);
      setStoryProgress(0);
    } else {
      setStoryProgress(0);
    }
  }, [activeStoryIndex]);

  // إدارة مؤقت الاستوري وتسجيل المشاهدات
  useEffect(() => {
    if (!activeStoryGroup) return;

    const currentStory = activeStoryGroup.stories[activeStoryIndex];
    if (!currentStory?.id) return;

    if (activeStoryGroup.userId !== userId && userId) {
      if (typeof recordStoryView === "function") {
        recordStoryView(currentStory.id, userId).catch(() => {});
      } else if (supabase) {
        supabase
          .from("story_views")
          .upsert(
            { story_id: currentStory.id, viewer_id: userId, viewed_at: new Date().toISOString() },
            { onConflict: "story_id,viewer_id" }
          )
          .then();
      }
    }

    if (activeStoryGroup.userId === userId) {
      setLoadingViewers(true);
      const loadViewers = async () => {
        try {
          if (typeof fetchStoryViewers === "function") {
            const list = await fetchStoryViewers(currentStory.id);
            setCurrentViewers(list || []);
          } else if (currentStory.viewers) {
            setCurrentViewers(currentStory.viewers);
          } else if (supabase) {
            const { data } = await supabase
              .from("story_views")
              .select("id, viewed_at, profiles:viewer_id(id, full_name, avatar_url, position)")
              .eq("story_id", currentStory.id);
            setCurrentViewers(data || []);
          }
        } catch {
          setCurrentViewers(currentStory.viewers || []);
        } finally {
          setLoadingViewers(false);
        }
      };
      loadViewers();
    }

    const mediaUrl = currentStory?.media_url || currentStory?.image_url || currentStory?.url;
    const isVideo = mediaUrl?.match(/\.(mp4|webm|ogg|mov)$/i);

    setStoryProgress(0);
    if (isVideo || showViewersModal) return;

    const DURATION = 5000;
    const INTERVAL = 50;
    const step = (INTERVAL / DURATION) * 100;

    const timer = setInterval(() => {
      setStoryProgress((prev) => {
        if (prev + step >= 100) {
          clearInterval(timer);
          handleNextStory();
          return 100;
        }
        return prev + step;
      });
    }, INTERVAL);

    return () => clearInterval(timer);
  }, [activeStoryGroup, activeStoryIndex, showViewersModal, handleNextStory, userId]);

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
      toast.success("تم نسخ رابط القصة");
    }
  };

  const handleDeleteCurrentStory = async (story) => {
    const targetId = story?.id;

    setLocalStories((prev) =>
      prev.filter((s) => (targetId ? s.id !== targetId : s.user_id !== activeStoryGroup?.userId))
    );
    setActiveStoryGroup(null);
    setActiveStoryIndex(0);
    setShowViewersModal(false);

    try {
      await deleteStory(targetId);
      toast.success("تم حذف القصة بنجاح");
      await dataState.reload();
    } catch (error) {
      console.error(error);
      toast.error("حدث خطأ أثناء الحذف من قاعدة البيانات");
      await dataState.reload();
    }
  };

  return (
    <PhoneShell withNav>
      <div className="flex flex-1 flex-col overflow-y-auto pb-6 no-scrollbar">
        {/* الترويسة العلوية */}
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationButton
              count={unreadCount}
              onClick={() => setNotificationsOpen((open) => !open)}
            />
          </div>
          <Logo size="h-9" />
          <Avatar name={profile?.full_name || ""} size="h-10 w-10" online />
        </div>

        {/* شريط القصص (الاستوري) */}
        <div className="flex gap-4 overflow-x-auto px-5 py-2 no-scrollbar" dir="rtl">
          {/* قصتك */}
          <div className="flex flex-col items-center gap-1.5 shrink-0">
            <div className="relative flex items-center justify-center">
              {myStoryGroup ? (
                <button
                  type="button"
                  onClick={() => {
                    setActiveStoryGroup(myStoryGroup);
                    setActiveStoryIndex(0);
                  }}
                  className="flex h-16 w-16 items-center justify-center rounded-full p-[2px] bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 shadow-md transition-transform active:scale-95"
                >
                  <span className="h-full w-full rounded-full border-2 border-background overflow-hidden bg-slate-900 flex items-center justify-center">
                    {myStoryGroup.stories[0]?.media_url || myStoryGroup.stories[0]?.image_url ? (
                      <img
                        src={
                          myStoryGroup.stories[0]?.media_url ||
                          myStoryGroup.stories[0]?.image_url
                        }
                        alt="قصتك"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="h-6 w-6 text-white" />
                    )}
                  </span>
                </button>
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-primary bg-surface text-primary">
                  <User className="h-6 w-6 text-muted-foreground" />
                </div>
              )}

              <label className="absolute -bottom-1 -left-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-primary text-white shadow-md border-2 border-background transition-transform active:scale-90">
                {storyUploading ? "..." : <Plus className="h-3.5 w-3.5" />}
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
                      toast.error(error?.message || "تعذر رفع القصة");
                    } finally {
                      setStoryUploading(false);
                      event.target.value = "";
                    }
                  }}
                />
              </label>
            </div>
            <span className="text-[11px] font-medium text-foreground">قصتك</span>
          </div>

          {/* قصص اللاعبين */}
          {otherStoryGroups.map((group) => {
            const firstStory = group.stories[0];
            const mediaUrl =
              firstStory?.media_url || firstStory?.image_url || firstStory?.url;
            const isVideo = mediaUrl?.match(/\.(mp4|webm|ogg|mov)$/i);

            return (
              <button
                key={group.userId}
                type="button"
                className="flex flex-col items-center gap-1.5 shrink-0 transition-transform active:scale-95"
                onClick={() => {
                  setActiveStoryGroup(group);
                  setActiveStoryIndex(0);
                }}
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full p-[2px] bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 shadow-md">
                  <span className="h-full w-full rounded-full border-2 border-background overflow-hidden bg-slate-900 flex items-center justify-center">
                    {isVideo ? (
                      <video
                        src={mediaUrl}
                        muted
                        playsInline
                        className="h-full w-full object-cover pointer-events-none"
                      />
                    ) : mediaUrl ? (
                      <img
                        src={mediaUrl}
                        alt="ستوري"
                        className="h-full w-full object-cover pointer-events-none"
                      />
                    ) : (
                      <User className="h-6 w-6 text-muted-foreground" />
                    )}
                  </span>
                </span>
                <span className="text-[11px] text-muted-foreground truncate w-16 text-center">
                  {group.userName}
                </span>
              </button>
            );
          })}
        </div>

        {/* حقل البحث */}
        <div className="px-5 pt-2">
          <label className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 shadow-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث عن ملعب أو منطقة.."
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
        </div>

        {/* الفلاتر */}
        <div className="flex items-center gap-2.5 overflow-x-auto px-5 pt-3 pb-1 no-scrollbar" dir="rtl">
          {[
            { id: "nearby", label: "اللعبات القريبة" },
            { id: "venues", label: "ملاعب" },
            { id: "active", label: "الربع النشط" },
          ].map((filter) => (
            <Chip
              key={filter.id}
              active={activeFilter === filter.id}
              onClick={() => setActiveFilter(filter.id)}
            >
              {filter.label}
            </Chip>
          ))}
        </div>

        {/* الخريطة */}
        <div className="px-5 pt-3">
          <div className="relative h-80 w-full overflow-hidden rounded-3xl border border-border shadow-sm">
            <LiveMap
              venues={rawData.mapPins}
              onVenueClick={(venue) =>
                toast.info(venue.address || `تم اختيار ${venue.name}`)
              }
              onLocate={(error) => error && toast.info("يرجى السماح بتحديد الموقع")}
            />
            <Link
              to="/fazaa"
              className="absolute bottom-4 left-4 flex items-center gap-1.5 rounded-full bg-gradient-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-glow transition-transform active:scale-95"
            >
              <Zap className="h-4 w-4" />
              فزعة
            </Link>
          </div>
        </div>
      </div>

      {/* عارض القصة */}
      {activeStoryGroup &&
        (() => {
          const currentStory = activeStoryGroup.stories[activeStoryIndex];
          const mediaUrl =
            currentStory?.media_url || currentStory?.image_url || currentStory?.url;
          const isVideo = mediaUrl?.match(/\.(mp4|webm|ogg|mov)$/i);
          const timeAgo = getTimeAgo(currentStory?.created_at);
          const isMyStory = activeStoryGroup.userId === userId;
          const viewersCount = currentViewers?.length || currentStory?.views_count || currentStory?.viewers_count || 0;

          return (
            <div className="fixed inset-0 z-[99999] h-[100dvh] w-full bg-black select-none flex flex-col justify-between overflow-hidden animate-in fade-in duration-200">
              <div className="absolute top-0 inset-x-0 z-30 p-4 pt-6 bg-gradient-to-b from-black/90 via-black/50 to-transparent">
                <div className="flex gap-1.5 mb-3">
                  {activeStoryGroup.stories.map((s, idx) => (
                    <div
                      key={s.id || idx}
                      className="h-1 flex-1 rounded-full bg-white/30 overflow-hidden"
                    >
                      <div
                        className="h-full bg-white transition-all duration-75 ease-linear"
                        style={{
                          width:
                            idx === activeStoryIndex
                              ? `${storyProgress}%`
                              : idx < activeStoryIndex
                              ? "100%"
                              : "0%",
                        }}
                      />
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-full border border-white/50 overflow-hidden bg-slate-800 flex items-center justify-center">
                      <User className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-xs font-bold text-white drop-shadow">
                        {activeStoryGroup.userName}
                      </span>
                      <span className="text-[10px] text-slate-300">{timeAgo}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 z-40">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShareStory(currentStory);
                      }}
                      className="p-2 rounded-full bg-black/40 text-white hover:bg-black/70 transition active:scale-90"
                      title="مشاركة"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>

                    {isMyStory && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCurrentStory(currentStory);
                        }}
                        className="p-2.5 rounded-full bg-rose-600/90 text-white hover:bg-rose-700 transition shadow-lg active:scale-90 flex items-center justify-center"
                        title="حذف القصة"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveStoryGroup(null);
                        setActiveStoryIndex(0);
                        setShowViewersModal(false);
                      }}
                      className="p-2 rounded-full bg-black/40 text-white hover:bg-black/70 transition active:scale-90"
                      title="إغلاق"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* جسم القصة الرئيسي */}
              <div
                className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden"
                onContextMenu={(e) => e.preventDefault()}
              >
                {isVideo ? (
                  <video
                    src={mediaUrl}
                    autoPlay
                    playsInline
                    onTimeUpdate={(e) => {
                      const p =
                        (e.currentTarget.currentTime / e.currentTarget.duration) * 100;
                      setStoryProgress(p || 0);
                    }}
                    onEnded={handleNextStory}
                    className="w-full h-full object-cover"
                  />
                ) : mediaUrl ? (
                  <img
                    src={mediaUrl}
                    alt="قصة"
                    onDragStart={(e) => e.preventDefault()}
                    className="w-full h-full object-cover select-none"
                  />
                ) : (
                  <p className="text-sm text-slate-400">الوسائط غير متوفرة</p>
                )}

                <div className="absolute inset-0 flex z-20">
                  <div
                    className="w-[35%] h-full cursor-pointer"
                    onClick={handlePrevStory}
                  />
                  <div
                    className="w-[65%] h-full cursor-pointer"
                    onClick={handleNextStory}
                  />
                </div>

                {isMyStory && (
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowViewersModal(true);
                      }}
                      className="flex items-center gap-2 rounded-full bg-black/60 backdrop-blur-md border border-white/20 px-4 py-2 text-white text-xs font-bold hover:bg-black/80 transition active:scale-95 shadow-xl"
                    >
                      <Eye className="h-4 w-4 text-emerald-400" />
                      <span>{viewersCount} مشاهدة</span>
                      <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                    </button>
                  </div>
                )}
              </div>

              {/* نافذة المشاهدين */}
              {showViewersModal && (
                <div
                  className="fixed inset-0 z-[100000] bg-black/70 backdrop-blur-sm flex flex-col justify-end animate-in fade-in duration-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowViewersModal(false);
                  }}
                >
                  <div
                    className="w-full max-h-[65dvh] bg-surface border-t border-border rounded-t-3xl p-5 flex flex-col gap-4 overflow-hidden animate-in slide-in-from-bottom duration-300"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <div className="flex items-center gap-2">
                        <Eye className="h-5 w-5 text-emerald-500" />
                        <h3 className="text-sm font-bold text-foreground">
                          المشاهدات ({viewersCount})
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowViewersModal(false)}
                        className="p-1 rounded-full bg-surface-2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar" dir="rtl">
                      {loadingViewers ? (
                        <p className="text-center text-xs text-muted-foreground py-6">
                          جاري تحميل المشاهدين...
                        </p>
                      ) : currentViewers.length > 0 ? (
                        currentViewers.map((item, idx) => {
                          const viewerProfile = item.profiles || item.user || item;
                          const name = viewerProfile.full_name || viewerProfile.name || "لاعب جوك";
                          const position = viewerProfile.position || "لاعب";
                          const viewedAt = getTimeAgo(item.viewed_at || item.created_at);

                          return (
                            <Link
                              key={item.id || idx}
                              to={viewerProfile.id ? `/player/${viewerProfile.id}` : "#"}
                              className="flex items-center justify-between p-2.5 rounded-2xl bg-surface-2/60 hover:bg-surface-2 transition"
                              onClick={() => setShowViewersModal(false)}
                            >
                              <div className="flex items-center gap-3">
                                <Avatar
                                  name={name}
                                  src={viewerProfile.avatar_url}
                                  size="h-10 w-10"
                                />
                                <div className="flex flex-col">
                                  <span className="text-xs font-bold text-foreground">
                                    {name}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {position}
                                  </span>
                                </div>
                              </div>
                              <span className="text-[10px] text-muted-foreground font-medium">
                                {viewedAt}
                              </span>
                            </Link>
                          );
                        })
                      ) : (
                        <div className="text-center py-8 text-muted-foreground text-xs">
                          <Eye className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          لا توجد مشاهدات حتى الآن
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
    </PhoneShell>
  );
}
