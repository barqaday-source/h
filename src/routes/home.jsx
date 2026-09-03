import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, Plus, Search, Zap, X, User, Share2, Trash2, Eye } from "lucide-react";
import { useEffect, useState } from "react";
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
  viewStory,
  fetchStoryViewers
} from "@/lib/data";
import { getSession } from "@/lib/supabase";

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
  const [viewers, setViewers] = useState([]);
  const [showViewers, setShowViewers] = useState(false);

  const dataState = useRemoteData(() => fetchHomeData({ query }), [query]);
  const notificationsState = useRemoteData(fetchNotifications, []);
  const rawData = dataState.data?? { stories: [], nearbyMatches: [], mapPins: [] };
  const notifications = notificationsState.data?? [];
  const unreadCount = notifications.filter((n) =>!n.read_at).length;

  useEffect(() => {
    getSession().then(({ session }) => {
      if (session?.user) {
        setUserId(session.user.id);
        fetchProfile(session.user.id).then((data) => data && setProfile(data)).catch(() => {});
      }
    });
  }, []);

  useEffect(() => {
    if (rawData.stories) setLocalStories(rawData.stories);
  }, [rawData.stories]);

  const validStories = (localStories || []).filter((s) => {
    if (!s.created_at) return true;
    return Date.now() - new Date(s.created_at).getTime() < 24 * 60 * 60 * 1000;
  });

  const groupedStories = validStories.reduce((acc, story) => {
    const ownerId = story.user_id || "unknown";
    if (!acc[ownerId]) {
      acc[ownerId] = {
        userId: ownerId,
        userName: story.profiles?.full_name || story.profiles?.display_name || story.title || "لاعب جوك",
        stories: [],
      };
    }
    acc[ownerId].stories.push(story);
    return acc;
  }, {});

  const myStoryGroup = userId && groupedStories[userId]? groupedStories[userId] : null;
  const otherStoryGroups = Object.values(groupedStories).filter((g) => g.userId!== userId);

  const handleNextStory = () => {
    if (!activeStoryGroup) return;
    if (activeStoryIndex < activeStoryGroup.stories.length - 1) {
      setActiveStoryIndex((p) => p + 1);
      setStoryProgress(0);
    } else {
      setActiveStoryGroup(null);
      setActiveStoryIndex(0);
      setStoryProgress(0);
      setShowViewers(false);
    }
  };

  const handlePrevStory = () => {
    if (activeStoryIndex > 0) {
      setActiveStoryIndex((p) => p - 1);
      setStoryProgress(0);
    }
  };

  useEffect(() => {
    if (!activeStoryGroup) return;
    const currentStory = activeStoryGroup.stories[activeStoryIndex];
    if (!currentStory?.id) return;

    viewStory(currentStory.id);
    if (activeStoryGroup.userId === userId) {
      fetchStoryViewers(currentStory.id).then(setViewers).catch(()=>{});
    } else {
      setViewers([]);
    }

    const mediaUrl = currentStory?.media_url || currentStory?.image_url || currentStory?.url;
    const isVideo = mediaUrl?.match(/\.(mp4|webm|ogg|mov)$/i);
    if (isVideo) return;

    const timer = setInterval(() => {
      setStoryProgress((prev) => {
        if (prev + 2 >= 100) {
          clearInterval(timer);
          handleNextStory();
          return 100;
        }
        return prev + 2;
      });
    }, 50);
    return () => clearInterval(timer);
  }, [activeStoryGroup, activeStoryIndex]);

  const handleShareStory = async (story) => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: "قصة على جوك", text: `شاهد قصة ${story.title || "لاعب"}`, url }); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("تم نسخ رابط القصة");
    }
  };

  const handleDeleteCurrentStory = async (story) => {
    const targetId = story?.id;
    setLocalStories((prev) => prev.filter((s) => targetId? s.id!== targetId : s.user_id!== activeStoryGroup?.userId));
    setActiveStoryGroup(null);
    setActiveStoryIndex(0);
    setShowViewers(false);
    try {
      await deleteStory(targetId);
      toast.success("تم حذف القصة بنجاح");
      await dataState.reload();
    } catch (e) {
      toast.error("حدث خطأ أثناء الحذف");
      await dataState.reload();
    }
  };

  return (
    <PhoneShell withNav>
      <div className="flex flex-1 flex-col overflow-y-auto pb-6 no-scrollbar">
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationButton count={unreadCount} onClick={() => setNotificationsOpen((o) =>!o)} />
          </div>
          <Logo size="h-9" />
          <Avatar name={profile?.full_name || profile?.display_name || ""} size="h-10 w-10" online />
        </div>

        <div className="flex gap-4 overflow-x-auto px-5 py-2 no-scrollbar" dir="rtl">
          <div className="flex flex-col items-center gap-1.5 shrink-0">
            <div className="relative flex items-center justify-center">
              {myStoryGroup? (
                <button type="button" onClick={() => { setActiveStoryGroup(myStoryGroup); setActiveStoryIndex(0); }} className="flex h-16 w-16 items-center justify-center rounded-full p- bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600">
                  <span className="h-full w-full rounded-full border-2 border-background overflow-hidden bg-slate-900 flex items-center justify-center">
                    <img src={myStoryGroup.stories[0]?.media_url || myStoryGroup.stories[0]?.image_url} alt="قصتك" className="h-full w-full object-cover" />
                  </span>
                </button>
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-primary bg-surface"><User className="h-6 w-6 text-muted-foreground" /></div>
              )}
              <label className="absolute -bottom-1 -left-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-primary text-white border-2 border-background">
                {storyUploading? "..." : <Plus className="h-3.5 w-3.5" />}
                <input type="file" accept="image/*,video/*" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0]; if (!file) return;
                  setStoryUploading(true);
                  try { await uploadStory(file); toast.success("تم رفع القصة"); await dataState.reload(); } catch (err) { toast.error(err?.message || "تعذر رفع القصة"); } finally { setStoryUploading(false); e.target.value = ""; }
                }} />
              </label>
            </div>
            <span className="text- font-medium">قصتك</span>
          </div>
          {otherStoryGroups.map((group) => {
            const firstStory = group.stories[0];
            const mediaUrl = firstStory?.media_url || firstStory?.image_url || firstStory?.url;
            const isVideo = mediaUrl?.match(/\.(mp4|webm|ogg|mov)$/i);
            return (
              <button key={group.userId} type="button" className="flex flex-col items-center gap-1.5 shrink-0" onClick={() => { setActiveStoryGroup(group); setActiveStoryIndex(0); }}>
                <span className="flex h-16 w-16 items-center justify-center rounded-full p- bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600">
                  <span className="h-full w-full rounded-full border-2 border-background overflow-hidden bg-slate-900 flex items-center justify-center">
                    {isVideo? <video src={mediaUrl} className="h-full w-full object-cover" /> : mediaUrl? <img src={mediaUrl} alt="ستوري" className="h-full w-full object-cover" /> : <User className="h-6 w-6 text-muted-foreground" />}
                  </span>
                </span>
                <span className="text- text-muted-foreground truncate w-16 text-center">{group.userName}</span>
              </button>
            );
          })}
        </div>

        <div className="px-5 pt-2">
          <label className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث عن ملعب أو منطقة.." className="w-full bg-transparent text-sm outline-none" />
          </label>
        </div>

        <div className="flex items-center gap-2.5 overflow-x-auto px-5 pt-3 pb-1 no-scrollbar" dir="rtl">
          {[{ id: "nearby", label: "اللعبات القريبة" }, { id: "venues", label: "ملاعب" }, { id: "active", label: "الربع النشط" }].map((filter) => (
            <Chip key={filter.id} active={activeFilter === filter.id} onClick={() => setActiveFilter(filter.id)}>{filter.label}</Chip>
          ))}
        </div>

        <div className="px-5 pt-3">
          <div className="relative h-80 w-full overflow-hidden rounded-3xl border border-border">
            <LiveMap venues={rawData.mapPins} onVenueClick={(v) => toast.info(v.address || v.name)} onLocate={(err) => err && toast.info("يرجى السماح بتحديد الموقع")} />
            <Link to="/fazaa" className="absolute bottom-4 left-4 flex items-center gap-1.5 rounded-full bg-gradient-primary px-4 py-2.5 text-xs font-bold text-primary-foreground"><Zap className="h-4 w-4" /> فزعة</Link>
          </div>
        </div>
      </div>

      {activeStoryGroup && (() => {
        const currentStory = activeStoryGroup.stories[activeStoryIndex];
        const mediaUrl = currentStory?.media_url || currentStory?.image_url || currentStory?.url;
        const isVideo = mediaUrl?.match(/\.(mp4|webm|ogg|mov)$/i);
        const timeAgo = getTimeAgo(currentStory?.created_at);
        const isMyStory = activeStoryGroup.userId === userId;
        return (
          <div className="fixed inset-0 z-[99999] h- w-full bg-black flex flex-col overflow-hidden">
            <div className="absolute top-0 inset-x-0 z-30 p-4 pt-6 bg-gradient-to-b from-black/90 to-transparent">
              <div className="flex gap-1.5 mb-3">
                {activeStoryGroup.stories.map((s, idx) => (
                  <div key={s.id || idx} className="h-1 flex-1 rounded-full bg-white/30 overflow-hidden">
                    <div className="h-full bg-white" style={{ width: idx === activeStoryIndex? `${storyProgress}%` : idx < activeStoryIndex? "100%" : "0%" }} />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-full border border-white/50 overflow-hidden bg-slate-800 flex items-center justify-center"><User className="h-5 w-5 text-white" /></div>
                  <div className="flex flex-col text-right"><span className="text-xs font-bold text-white">{activeStoryGroup.userName}</span><span className="text- text-slate-300">{timeAgo}</span></div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={(e) => { e.stopPropagation(); handleShareStory(currentStory); }} className="p-2 rounded-full bg-black/40 text-white"><Share2 className="h-4 w-4" /></button>
                  {isMyStory && <button onClick={(e) => { e.stopPropagation(); handleDeleteCurrentStory(currentStory); }} className="p-2.5 rounded-full bg-rose-600/90 text-white"><Trash2 className="h-4 w-4" /></button>}
                  <button onClick={() => { setActiveStoryGroup(null); setShowViewers(false); }} className="p-2 rounded-full bg-black/40 text-white"><X className="h-5 w-5" /></button>
                </div>
              </div>
            </div>
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              {isVideo? <video src={mediaUrl} autoPlay playsInline onTimeUpdate={(e) => setStoryProgress((e.currentTarget.currentTime / e.currentTarget.duration) * 100 || 0)} onEnded={handleNextStory} className="w-full h-full object-cover" /> : mediaUrl? <img src={mediaUrl} alt="قصة" className="w-full h-full object-cover" /> : <p className="text-sm text-slate-400">الوسائط غير متوفرة</p>}
              <div className="absolute inset-0 flex z-20"><div className="w-[35%] h-full" onClick={handlePrevStory} /><div className="w-[65%] h-full" onClick={handleNextStory} /></div>
              {isMyStory && <button onClick={() => setShowViewers(v =>!v)} className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full bg-black/60 backdrop-blur px-5 py-2.5 text-white text-xs font-bold border border-white/10"><Eye className="h-4 w-4" />{viewers.length} مشاهدة</button>}
