"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";
import ThemeToggle from "./ThemeToggle";

const nav = [
  { href: "/", label: "Overview", icon: "▦", group: "Overview" },
  { href: "/data-analysis", label: "Data & Analysis", icon: "◐", group: "Overview" },

  { href: "/farms", label: "Farms & Plots", icon: "⬡", group: "My Farm" },
  { href: "/contracts", label: "Rental Contracts", icon: "▤", group: "My Farm" },

  { href: "/workers", label: "My Workers", icon: "◉", group: "People" },
  { href: "/payroll", label: "Payroll", icon: "▥", group: "People" },

  { href: "/loans", label: "Borrowings", icon: "◈", group: "Loans" },

  { href: "/harvest-record", label: "Harvest Record", icon: "✳", group: "Income" },
  { href: "/sales", label: "Sales Record", icon: "◍", group: "Income" },

  { href: "/purchases", label: "Purchases", icon: "▨", group: "Expenses" },
  { href: "/payment", label: "Payment", icon: "◑", group: "Expenses" },
  { href: "/worker-expenses", label: "Worker Expenses", icon: "▩", group: "Expenses" },
  { href: "/salary", label: "Salary", icon: "◔", group: "Expenses" },

  { href: "/inventory", label: "Stock Level", icon: "▧", group: "Inventory" },

  { href: "/schedule", label: "Task Schedule", icon: "▣", group: "Operation" },
  { href: "/applications", label: "Agri Inputs", icon: "❋", group: "Operation" },

  { href: "/projects", label: "Setup Projects", icon: "⚒", group: "Operation" },

  { href: "/settings/crop-variety", label: "Crop & Variety", icon: "❖", group: "Setting" },
  { href: "/settings/collectors", label: "Collectors", icon: "◫", group: "Setting" },
  { href: "/settings/vendors", label: "Vendors", icon: "◨", group: "Setting" },
  { href: "/settings/dashboard", label: "Dashboard", icon: "⚙", group: "Setting" },
];

const groups = ["Overview", "My Farm", "People", "Loans", "Income", "Expenses", "Inventory", "Operation", "Setting"];

export default function Sidebar() {
  const pathname = usePathname();
  const { db, resetData } = useStore();
  const { appName, appSubtitle, logoDataUrl } = db.settings;
  // drawer state; only applies below the lg breakpoint (nav links close it on click)
  const [open, setOpen] = useState(false);

  const current = nav.find((n) => n.href === pathname)?.label ?? appName;

  return (
    <>
      {/* Mobile top bar */}
      <header className="no-print fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-hairline bg-surface px-4 lg:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-hairline text-ink-2 transition-colors hover:bg-surface-2"
        >
          <span aria-hidden>☰</span>
        </button>
        <span className="truncate text-sm font-semibold text-ink">{current}</span>
        <div className="ml-auto">
          <ThemeToggle compact />
        </div>
      </header>

      {/* Backdrop, mobile only */}
      {open && (
        <div
          className="no-print fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`no-print fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-hairline bg-surface transition-transform duration-200 lg:z-40 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between gap-2 px-4 py-4">
          <div className="flex items-center gap-2.5">
            {logoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoDataUrl}
                alt={`${appName} logo`}
                className="h-8 w-8 rounded-lg object-contain"
              />
            ) : (
              <span
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-on-accent"
                aria-hidden
              >
                {(appName.trim()[0] ?? "F").toUpperCase()}
              </span>
            )}
            <div>
              <p className="text-sm font-semibold tracking-tight text-ink">{appName}</p>
              {appSubtitle && <p className="text-xs text-muted">{appSubtitle}</p>}
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="-mr-1 text-muted transition-colors hover:text-ink lg:hidden"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-3">
          {groups.map((group) => (
            <div key={group} className="mb-3">
              <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-muted uppercase">
                {group}
              </p>
              {nav
                .filter((item) => item.group === group)
                .map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`mb-0.5 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                        active
                          ? "bg-accent-soft font-semibold text-accent"
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
            </div>
          ))}
        </nav>

        <div className="space-y-2 border-t border-hairline p-3">
          <div className="hidden lg:block">
            <ThemeToggle />
          </div>
          <button
            onClick={() => {
              if (confirm("Reset all data back to the sample dataset?")) resetData();
            }}
            className="w-full rounded-lg px-3 py-2 text-left text-xs text-muted transition-colors hover:bg-surface-2 hover:text-ink-2"
          >
            ↺ Reset sample data
          </button>
        </div>
      </aside>
    </>
  );
}
