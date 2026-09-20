"use client";

import { useTheme } from "@/lib/theme";

const SunIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);

/** Segmented light/dark control, styled after ClickUp's pill toggles. */
export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();

  const item = (value: "light" | "dark", label: string, icon: React.ReactNode) => {
    const active = theme === value;
    return (
      <button
        key={value}
        onClick={() => setTheme(value)}
        aria-pressed={active}
        aria-label={`${label} mode`}
        title={`${label} mode`}
        className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors ${
          active ? "bg-chip-active text-ink shadow-card" : "text-muted hover:text-ink-2"
        }`}
      >
        {icon}
        {!compact && label}
      </button>
    );
  };

  return (
    <div className="flex items-center gap-0.5 rounded-full bg-surface-2 p-0.5" role="group" aria-label="Colour theme">
      {item("light", "Light", <SunIcon />)}
      {item("dark", "Dark", <MoonIcon />)}
    </div>
  );
}
