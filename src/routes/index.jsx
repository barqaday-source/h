import { createFileRoute, Link } from "@tanstack/react-router";
import pitchNight from "@/assets/pitch-night.jpg";
import { Logo, PhoneShell, ThemeToggle } from "@/components/ui-kit";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "جوك | جمع ربعك وعيش جوك" },
      {
        name: "description",
        content: "جوك تطبيق يجمع لاعبي كرة القدم: ملاعب قريبة، فزعة سريعة، ودردشة تنسيق المباريات.",
      },
      { property: "og:title", content: "جوك | جمع ربعك وعيش جوك" },
      {
        property: "og:description",
        content: "منصة تجمع لاعبي كرة القدم في مكان واحد — ملاعب، فزعة، وتقييم بعد المباراة.",
      },
    ],
  }),
  component: SplashScreen,
});

/** 1. شاشة البداية (Splash) */
function SplashScreen() {
  return (
    <PhoneShell>
      <div className="relative flex flex-1 flex-col">
        <img
          src={pitchNight}
          alt="ملعب كرة قدم ليلاً تحت الأضواء"
          width={900}
          height={1600}
          className="absolute inset-0 h-full w-full object-cover opacity-45 dark:opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-hero" />

        <div className="relative flex items-start justify-end p-5">
          <ThemeToggle />
        </div>

        <div className="relative flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <Logo size="text-6xl" />
          <p className="text-sm font-semibold text-muted-foreground">جمع ربعك وعيش جوك</p>
        </div>

        <div className="relative flex flex-col items-center gap-4 px-10 pb-12">
          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-secondary">
            <div className="h-full w-2/3 rounded-full bg-gradient-primary" />
          </div>
          <p className="text-xs text-muted-foreground">جوك يبدأ من هنا..</p>
          <Link
            to="/onboarding"
            className="w-full rounded-2xl bg-gradient-primary py-3.5 text-center text-sm font-bold text-primary-foreground shadow-glow"
          >
            ابدأ
          </Link>
        </div>
      </div>
    </PhoneShell>
  );
}
