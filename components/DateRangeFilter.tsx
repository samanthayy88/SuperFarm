"use client";

import { fmtDate } from "@/lib/utils";

/** An inclusive "YYYY-MM-DD" period. A blank end means open-ended, so both blank = all time. */
export interface DateRange {
  from: string;
  to: string;
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** The whole of a "YYYY-MM" month as a range. */
export function monthRange(month: string): DateRange {
  const [y, m] = month.split("-").map(Number);
  return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
}

export function inDateRange(date: string, r: DateRange): boolean {
  const d = date.slice(0, 10);
  return (!r.from || d >= r.from) && (!r.to || d <= r.to);
}

/** "Jul 2026" for one whole month, otherwise "1 Jul 2026 – 20 Aug 2026". */
export function rangeLabel(r: DateRange): string {
  if (!r.from && !r.to) return "all time";
  if (r.from && r.to) {
    const whole = monthRange(r.from.slice(0, 7));
    if (whole.from === r.from && whole.to === r.to)
      return new Date(r.from + "T00:00:00").toLocaleDateString("en-MY", { month: "short", year: "numeric" });
    return `${fmtDate(r.from)} – ${fmtDate(r.to)}`;
  }
  return r.from ? `from ${fmtDate(r.from)}` : `up to ${fmtDate(r.to)}`;
}

const PRESETS: { id: string; label: string; range: () => DateRange }[] = [
  {
    id: "this-month",
    label: "This month",
    range: () => monthRange(iso(new Date()).slice(0, 7)),
  },
  {
    id: "last-month",
    label: "Last month",
    range: () => {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - 1);
      return monthRange(iso(d).slice(0, 7));
    },
  },
  {
    id: "last-3",
    label: "Last 3 months",
    range: () => {
      const start = new Date();
      start.setDate(1);
      start.setMonth(start.getMonth() - 2);
      return { from: iso(start), to: monthRange(iso(new Date()).slice(0, 7)).to };
    },
  },
  {
    id: "this-year",
    label: "This year",
    range: () => ({ from: `${new Date().getFullYear()}-01-01`, to: `${new Date().getFullYear()}-12-31` }),
  },
  {
    id: "last-year",
    label: "Last year",
    range: () => ({ from: `${new Date().getFullYear() - 1}-01-01`, to: `${new Date().getFullYear() - 1}-12-31` }),
  },
  { id: "all", label: "All time", range: () => ({ from: "", to: "" }) },
];

const inputClass =
  "rounded-full border border-hairline bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25";

/**
 * Period picker: a preset dropdown plus From / To. In `monthly` mode the two ends are
 * whole months (for the Salary page, which is worked out month by month).
 */
export default function DateRangeFilter({
  value,
  onChange,
  monthly = false,
}: {
  value: DateRange;
  onChange: (r: DateRange) => void;
  monthly?: boolean;
}) {
  const matched = PRESETS.find((p) => {
    const r = p.range();
    return r.from === value.from && r.to === value.to;
  });

  const setFrom = (v: string) => onChange({ ...value, from: monthly ? (v ? monthRange(v).from : "") : v });
  const setTo = (v: string) => onChange({ ...value, to: monthly ? (v ? monthRange(v).to : "") : v });
  const bad = Boolean(value.from && value.to && value.from > value.to);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={matched?.id ?? "custom"}
        onChange={(e) => {
          const p = PRESETS.find((x) => x.id === e.target.value);
          if (p) onChange(p.range());
        }}
        className={`${inputClass} font-medium`}
        aria-label="Period"
      >
        {PRESETS.map((p) => (
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
        {!matched && <option value="custom">Custom period</option>}
      </select>
      <label className="flex items-center gap-1.5 text-xs text-muted">
        From
        <input
          type={monthly ? "month" : "date"}
          value={monthly ? value.from.slice(0, 7) : value.from}
          onChange={(e) => setFrom(e.target.value)}
          className={inputClass}
          aria-label="From"
        />
      </label>
      <label className="flex items-center gap-1.5 text-xs text-muted">
        To
        <input
          type={monthly ? "month" : "date"}
          value={monthly ? value.to.slice(0, 7) : value.to}
          onChange={(e) => setTo(e.target.value)}
          className={`${inputClass} ${bad ? "border-critical" : ""}`}
          aria-label="To"
        />
      </label>
      {bad && <span className="text-xs text-critical">“From” is after “To”.</span>}
    </div>
  );
}
