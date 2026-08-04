"use client";

import { useState } from "react";
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
  // drawer state; only applies below the lg breakpoint (nav links close it on click)
  const [open, setOpen] = useState(false);

  const current = nav.find((n) => n.href === pathname)?.label ?? "Farm Manager";

  return (
    <>
      {/* Mobile top bar */}
      <header className="no-print fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-hairline bg-surface px-4 lg:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="flex h-9 w-9 items-center justify-center rounded border border-hairline text-ink-2 hover:bg-surface-2"
        >
          <span aria-hidden>☰</span>
        </button>
        <span className="truncate text-sm font-medium">{current}</span>
      </header>

      {/* Backdrop, mobile only */}
      {open && (
        <div
          className="no-print fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`no-print fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-hairline bg-surface transition-transform duration-200 lg:z-40 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between border-b border-hairline px-5 py-4">
          <div>
            <p className="text-base font-semibold tracking-tight">Farm Manager</p>
            <p className="mt-0.5 text-xs text-muted">Multi-farm operations</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="-mr-1 text-muted hover:text-ink lg:hidden"
          >
            ✕
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
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
    </>
  );
}
