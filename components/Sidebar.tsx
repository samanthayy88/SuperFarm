"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";

const nav = [
  { href: "/", label: "Overview", icon: "▦" },
  { href: "/farms", label: "Farms & Plots", icon: "⬡" },
  { href: "/contracts", label: "Rental Contracts", icon: "▤" },
  { href: "/loans", label: "Loans", icon: "◈" },
  { href: "/projects", label: "Setup Projects", icon: "⚒" },
  { href: "/workers", label: "Workers", icon: "◉" },
  { href: "/payroll", label: "Payroll & Commission", icon: "▥" },
  { href: "/schedule", label: "Schedule", icon: "▣" },
  { href: "/sales", label: "Sales & Collectors", icon: "◍" },
  { href: "/inventory", label: "Purchases & Inventory", icon: "▧" },
  { href: "/applications", label: "Spray Applications", icon: "❋" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { resetData } = useStore();

  return (
    <aside className="no-print fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-hairline bg-surface">
      <div className="border-b border-hairline px-5 py-4">
        <p className="text-base font-semibold tracking-tight">Farm Manager</p>
        <p className="mt-0.5 text-xs text-muted">Multi-farm operations</p>
      </div>
      <nav className="flex-1 overflow-y-auto p-3">
        {nav.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`mb-0.5 flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-accent/15 font-medium text-accent"
                  : "text-ink-2 hover:bg-surface-2 hover:text-ink"
              }`}
            >
              <span className="w-4 text-center text-xs" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-hairline p-3">
        <button
          onClick={() => {
            if (confirm("Reset all data back to the sample dataset?")) resetData();
          }}
          className="w-full rounded px-3 py-2 text-left text-xs text-muted transition-colors hover:bg-surface-2 hover:text-ink-2"
        >
          ↺ Reset sample data
        </button>
      </div>
    </aside>
  );
}
