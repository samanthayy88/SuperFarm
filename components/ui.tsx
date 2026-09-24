"use client";

import React from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  title,
  actions,
  children,
  className = "",
}: {
  title?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-card border border-hairline bg-surface shadow-card ${className}`}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-3">
          {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
          {actions}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "warning" | "critical";
}) {
  const toneClass =
    tone === "good"
      ? "text-good"
      : tone === "warning"
        ? "text-warning"
        : tone === "critical"
          ? "text-critical"
          : "text-ink";
  return (
    <div className="rounded-card border border-hairline bg-surface p-4 shadow-card">
      <p className="text-xs font-medium tracking-wide text-muted">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tnum ${toneClass}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

type BadgeTone = "neutral" | "good" | "warning" | "serious" | "critical" | "accent";

/* ClickUp-style pill: saturated label on a soft tint of the same hue. */
const badgeStyles: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  good: "bg-good-soft text-good",
  warning: "bg-warning-soft text-warning",
  serious: "bg-serious-soft text-serious",
  critical: "bg-critical-soft text-critical",
  accent: "bg-accent-soft text-accent",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${badgeStyles[tone]}`}
    >
      {children}
    </span>
  );
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`border-b border-hairline px-3 py-2.5 text-xs font-semibold tracking-wide text-muted ${right ? "text-right" : ""}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  right,
  className = "",
}: {
  children?: React.ReactNode;
  right?: boolean;
  className?: string;
}) {
  return (
    <td
      className={`border-b border-grid px-3 py-2.5 align-top text-ink-2 ${right ? "text-right tnum" : ""} ${className}`}
    >
      {children}
    </td>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  type = "button",
  small,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  type?: "button" | "submit";
  small?: boolean;
}) {
  const base = small ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";
  const style =
    variant === "primary"
      ? "bg-solid text-on-solid hover:bg-solid-hover"
      : variant === "danger"
        ? "bg-critical-soft text-critical hover:brightness-95"
        : "border border-hairline bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink";
  return (
    <button
      type={type}
      onClick={onClick}
      className={`rounded-lg font-medium transition-colors ${base} ${style}`}
    >
      {children}
    </button>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-12 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`w-full ${wide ? "max-w-3xl" : "max-w-lg"} rounded-card border border-hairline bg-surface shadow-pop`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label="Close"
          >
            ✕
          </button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-2">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputClass} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={inputClass} />;
}

/** ClickUp-style pill dropdown for picking a "YYYY-MM" month, e.g. "Sept 2026". */
export function MonthSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (month: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-sm font-medium text-ink"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <p className="py-8 text-center text-sm text-muted">{message}</p>;
}

/** ClickUp-style view switcher: soft pills rather than an underlined tab rail. */
export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: string[];
  active: string;
  onChange: (t: string) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-1 rounded-lg bg-surface-2 p-1">
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            active === t
              ? "bg-chip-active text-ink shadow-card"
              : "text-muted hover:text-ink"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

/**
 * Destructive confirmation that spells out what will be removed.
 * `impacts` lists linked records the delete will also take with it, so the
 * consequence is visible before the click rather than discovered afterwards.
 */
export function ConfirmDialog({
  title,
  message,
  impacts = [],
  confirmLabel = "Delete",
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  impacts?: string[];
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-sm text-ink-2">{message}</p>

      {impacts.length > 0 && (
        <div className="mt-3 rounded-lg border border-critical/30 bg-critical-soft px-3 py-2.5">
          <p className="text-xs font-semibold text-critical">
            This will also permanently delete linked records:
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {impacts.map((i) => (
              <li key={i} className="text-xs text-critical">
                • {i}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-xs text-muted">This cannot be undone.</p>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputClass} resize-y leading-relaxed`} />;
}
