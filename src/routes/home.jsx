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

  // حالات قائمة المشاهدات
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

  const validStories = (localStories || []).filter((s) => {
    if (!s || !s.created_at) return true;
    const createdAt = new Date(s.created_at).getTime();
    const now = new Date().getTime();
    return now - createdAt < 24 * 60 * 60 * 1000;
  });

  const groupedStories = validStories.reduce((acc, story) => {
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

  const myStoryGroup = userId && groupedStories[userId] ? groupedStories[userId] : null;
  const otherStoryGroups = Object.values(groupedStories).filter((g) => g.userId !== userId);

  const handleNextStory = () => {
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
  };

  const handlePrevStory = () => {
    if (activeStoryIndex > 0) {
      setActiveStoryIndex((prev) => prev - 1);
      setStoryProgress(0);
    } else {
      setStoryProgress(0);
    }
  };

  // تسجيل المشاهدة وجلب قائمة المشاهدين بأمان عبر Supabase
  useEffect(() => {
    if (!activeStoryGroup) return;

    const currentStory = activeStoryGroup.stories?.[activeStoryIndex];
    if (!currentStory?.id) return;

    // 1. تسجيل المشاهدة إذا كانت قصة شخص آخر
    if (activeStoryGroup.userId !== userId && userId && supabase) {
      supabase
        .from("story_views")
        .upsert(
          { story_id: currentStory.id, viewer_id: userId, viewed_at: new Date().toISOString() },
          { onConflict: "story_id,viewer_id" }
        )
        .then()
        .catch(() => {});
    }

    // 2. جلب المشاهدين إذا كانت القصة خاصة بك
    if (activeStoryGroup.userId === userId && supabase) {
      setLoadingViewers(true);
      supabase
        .from("story_views")
        .select("id, viewed_at, profiles:viewer_id(id, full_name, avatar_url, position)")
        .eq("story_id", currentStory.id)
        .then(({ data }) => {
          setCurrentViewers(data || []);
        })
        .catch(() => setCurrentViewers([]))
        .finally(() => setLoadingViewers(false));
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
  }, [activeStoryGroup, activeStoryIndex, showViewersModal]);

  const handleShareStory = async (story) => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "قصة على جوك",
          text: `شاهد قصة ${story?.title || "لاعب"} على جوك!`,
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
      toast.error("حدث خطأ أثناء الحذف");
      await dataState.reload();
    }
  };

  return (
    <PhoneShell withNav>
      <div className="flex flex-1 flex-col overflow-yهذه الشاشة تظهر من **GitHub Codespaces** عند انقطاع الاتصال بين المنفذ (Port 8080) والسيرفر المحلي (Dev Server)، أو بسبب عدم استماع التطبيق على العنوان الصحيح داخل البيئة الافتراضية.

**خطوات الحل:**

* **تأكد من تشغيل السيرفر في Terminal:** ارجع لتبويب VS Code وافحص الـ Terminal. إذا توقف السيرفر أو ظهر خطأ كود (Crash)، أعد تشغيله بأمر `npm run dev` أو `bun dev`.
* **تفعيل خاصية Host في Vite:** داخل Codespaces، يجب توجيه Vite للاستماع على جميع شبكات البيئة (`0.0.0.0`).
  * في ملف `package.json` عدّل أمر التشغيل إلى: 
    ```json
    "dev": "vite --host"
    ```
  * أو في ملف `vite.config.js` أضف إعدادات السيرفر:
    ```javascript
    export default defineConfig({
      server: {
        host: true,
        port: 8080
      }
    })
    ```
* **مراجعة تبويب Ports:** افتح تبويب **Ports** في أسفل نافذة VS Code، وتأكد أن المنفذ `8080` موجود وحالته شغال. إذا لم يجدد الاتصال تلقائياً، اضغط كليك يمين على المنفذ واختر **Port Protocol -> HTTP** أو غيّر الرؤية إلى **Public**.
* **تجربة المسار الرئيسي:** احذف `/home` من شريط العنوان وجرّب فتح الرابط الأساسي للتأكد مما إذا كانت المشكلة بسبب عدم توفر مسار التوجيه (Routing).
