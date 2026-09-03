import { Bell, Home, MessageCircle, Moon, Sun, User, Zap } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useTheme } from "@/lib/theme";

/** إطار الموبايل: كل الشاشات تُعرض بمقاس هاتف حصراً. */
export function PhoneShell({ children, withNav = false }) {
  return (
    <div className="min-h-screen w-full bg-secondary/40 py-0 sm:py-6">
      <div className="relative mx-auto flex min-h-screen w-full max-w-[430px] flex-col overflow-hidden bg-background shadow-card sm:min-h-[860px] sm:rounded-[2.25rem] sm:border sm:border-border">
        <div className={`flex flex-1 flex-col ${withNav ? "pb-24" : ""}`}>{children}</div>
        {withNav ? <BottomNav /> : null}
      </div>
    </div>
  );
}

/** تعطيل الشريط الوهمي والوقت 9:41 نهائياً */
export function StatusBar() {
  return null;
}

export function ThemeToggle({ className = "" }) {
  const { theme, toggleTheme } = useTheme();
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="تبديل الوضع الداكن والفاتح"
      className={`flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-colors hover:bg-surface-2 ${className}`}
    >
      <Icon className="h-4.5 w-4.5" />
    </button>
  );
}

/** مكون الشعار المتجهي الاصلي عالي الجودة لتطبيق جوّك */
export function Logo({ size = "h-12", className = "" }) {
  return (
    <div className={`inline-flex items-center justify-center select-none ${className}`}>
      <svg
        viewBox="0 0 400 160"
        role="img"
        aria-label="جوك | جمع ربعك وعيش جوك"
        preserveAspectRatio="xMidYMid meet"
        className={`w-auto ${size} drop-shadow-sm transition-transform duration-200 hover:scale-105`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="jawkLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <filter id="jawkLogoGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="12" />
          </filter>
        </defs>
        <rect width="400" height="160" rx="16" fill="#0f172a" />
        <circle cx="200" cy="70" r="60" fill="#10b981" opacity="0.1" filter="url(#jawkLogoGlow)" />
        <text
          x="200"
          y="88"
          textAnchor="middle"
          direction="rtl"
          fill="url(#jawkLogoGradient)"
          fontFamily="Lalezar, Tajawal, Cairo, Arial, sans-serif"
          fontSize="72"
          fontWeight="700"
        >
          جَوَّك
        </text>
        <text
          x="200"
          y="130"
          textAnchor="middle"
          fill="#a1a1aa"
          fontFamily="system-ui, sans-serif"
          fontSize="13"
          fontWeight="600"
          letterSpacing="0.5"
        >
          جَمّع رَبْعَك وَعِيش جَوَّك
        </text>
      </svg>
    </div>
  );
}

export function Avatar({ name, size = "h-12 w-12", online = false, ring = false }) {
  return (
    <div className="relative inline-flex">
      <div
        className={`${size} flex items-center justify-center rounded-full bg-gradient-primary text-sm font-bold text-primary-foreground ${
          ring ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
        }`}
      >
        {name?.slice(0, 2)}
      </div>
      {online ? (
        <span className="absolute -bottom-0.5 -left-0.5 h-3 w-3 rounded-full border-2 border-background bg-primary" />
      ) : null}
    </div>
  );
}

export function Card({ children, className = "" }) {
  return (
    <div className={`relative z-10 my-4 rounded-2xl border border-border bg-card p-5 shadow-card ${className}`}>
      {children}
    </div>
  );
}

export function PrimaryButton({ children, className = "", ...props }) {
  return (
    <button
      type="button"
      className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary px-6 py-4 text-sm font-bold text-primary-foreground shadow-glow transition-opacity hover:opacity-90 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function GhostButton({ children, className = "", ...props }) {
  return (
    <button
      type="button"
      className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-6 py-4 text-sm font-semibold text-foreground transition-colors hover:bg-surface-2 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Chip({ children, active = false }) {
  return (
    <span
      className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold ${
        active
          ? "bg-primary text-primary-foreground"
          : "border border-border bg-surface text-muted-foreground"
      }`}
    >
      {children}
    </span>
  );
}

export function SectionTitle({ children, action }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 pb-4 pt-7">
      <h2 className="text-sm font-bold text-foreground">{children}</h2>
      {action ? <span className="text-xs text-muted-foreground">{action}</span> : null}
    </div>
  );
}

export function ProgressBar({ value }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
      <div className="h-full rounded-full bg-gradient-primary" style={{ width: `${value}%` }} />
    </div>
  );
}

export function TopBar({ title, left = null, right = null }) {
  return (
    <div className="flex items-center justify-between px-5 py-3">
      <div className="flex items-center gap-2">{right}</div>
      <h2 className="text-lg font-extrabold text-foreground">{title}</h2>
      <div className="flex items-center gap-2">{left}</div>
    </div>
  );
}

export function NotificationButton({ count = 0, onClick }) {
  return (
    <button
      onClick={onClick}
      type="button"
      aria-label="الإشعارات"
      className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-foreground"
    >
      <Bell className="h-4.5 w-4.5" />
      <span className="absolute -top-1 -left-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
        {count}
      </span>
    </button>
  );
}

const navItems = [
  { to: "/home", label: "الرئيسية", Icon: Home },
  { to: "/fazaa", label: "الفزعة", Icon: Zap },
  { to: "/chat", label: "الدردشة", Icon: MessageCircle },
  { to: "/profile", label: "البروفايل", Icon: User },
];

export function BottomNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <nav className="absolute bottom-0 right-0 left-0 mx-auto flex max-w-[430px] items-center justify-around border-t border-border bg-surface/95 px-2 py-3 backdrop-blur">
      {navItems.map(({ to, label, Icon }) => {
        const active = pathname === to;
        return (
          <Link
            key={to}
            to={to}
            className={`flex flex-col items-center gap-1 rounded-xl px-3 py-1 text-[11px] font-semibold ${
              active ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
