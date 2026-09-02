import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Heart, MapPin, Sparkles } from "lucide-react";
import playersDusk from "@/assets/players-dusk.jpg";
import { Card, PhoneShell, StatusBar, ThemeToggle } from "@/components/ui-kit";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "تعرف على جوك | شاشات الترحيب" },
      {
        name: "description",
        content: "جوك مو بس لعبة: اكتشف الملاعب القريبة، الفزعة الذكية، وأجواء كرة القدم بكل وقت.",
      },
      { property: "og:title", content: "تعرف على جوك" },
      { property: "og:description", content: "ترحيب وتعريف بمزايا جوك: خريطة الملاعب والفزعة الذكية." },
    ],
  }),
  component: OnboardingScreen,
});

const features = [
  { id: "donate", label: "تبرع وساعد بتطوير الملاعب", Icon: Heart },
  { id: "ai", label: "الفزعة الذكية", Icon: Sparkles },
  { id: "map", label: "خريطة الملاعب", Icon: MapPin },
];

/** 2. شاشات الترحيب والتعريف (Onboarding) */
function OnboardingScreen() {
  return (
    <PhoneShell>
      <StatusBar />
      <div className="flex items-center justify-between px-5 pt-2">
        <ThemeToggle />
        <Link to="/auth" className="text-xs font-semibold text-muted-foreground">
          تخطي
        </Link>
      </div>

      <div className="px-5 pt-4">
        <div className="relative h-64 overflow-hidden rounded-3xl">
          <img
            src={playersDusk}
            alt="لاعبون جالسون على أرض الملعب وقت الغروب"
            width={900}
            height={1200}
            loading="lazy"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-hero" />
        </div>
      </div>

      <div className="px-6 pt-6 text-right">
        <h2 className="text-2xl font-extrabold text-foreground">
          <span className="text-primary">جوك</span> مو بس لعبة..
        </h2>
        <p className="pt-1 text-lg font-bold text-foreground">جوك تجمع، حماس، وصحبة!</p>
        <p className="pt-3 text-sm leading-relaxed text-muted-foreground">
          اكتشف الملاعب، جمع ربعك، وعيش أجواء كرة القدم بكل وقت.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 px-5 pt-6">
        {features.map(({ id, label, Icon }) => (
          <Card key={id} className="flex flex-col items-center gap-2 p-3 text-center">
            <Icon className="h-5 w-5 text-primary" />
            <span className="text-[11px] font-semibold leading-tight text-muted-foreground">
              {label}
            </span>
          </Card>
        ))}
      </div>

      <div className="mt-auto flex flex-col items-center gap-5 px-6 pb-10 pt-8">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-5 rounded-full bg-primary" />
          <span className="h-1.5 w-1.5 rounded-full bg-border" />
          <span className="h-1.5 w-1.5 rounded-full bg-border" />
        </div>
        <Link
          to="/auth"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-4 text-sm font-bold text-primary-foreground shadow-glow"
        >
          ابدأ الآن
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </div>
    </PhoneShell>
  );
}
