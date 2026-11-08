"use client";

import { fmtDate } from "@/lib/utils";
import { Button, Field, TextInput } from "@/components/ui";

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
  { id: "today", label: "Today", range: () => ({ from: iso(new Date()), to: iso(new Date()) }) },
  {
    id: "last-7",
    label: "Last 7 days",
    range: () => {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      return { from: iso(d), to: iso(new Date()) };
    },
  },
  {
    id: "last-30",
    label: "Last 30 days",
    range: () => {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      return { from: iso(d), to: iso(new Date()) };
    },
  },
  { id: "this-month", label: "This month", range: () => monthRange(iso(new Date()).slice(0, 7)) },
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
    id: "this-year",
    label: "This year",
    range: () => ({ from: `${new Date().getFullYear()}-01-01`, to: `${new Date().getFullYear()}-12-31` }),
  },
  // "Clear" = no limit at either end, i.e. all time
  { id: "all", label: "Clear", range: () => ({ from: "", to: "" }) },
];

// the Salary page works month by month, so a single day or week makes no sense there
const MONTHLY_PRESETS = ["this-month", "last-month", "this-year", "all"];

/**
 * Period picker in the Work Schedule style: From / To boxes with their labels above, and pill
 * buttons underneath. In `monthly` mode the two ends are whole months (for the Salary page).
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
  const presets = monthly ? PRESETS.filter((p) => MONTHLY_PRESETS.includes(p.id)) : PRESETS;
  const setFrom = (v: string) => onChange({ ...value, from: monthly ? (v ? monthRange(v).from : "") : v });
  const setTo = (v: string) => onChange({ ...value, to: monthly ? (v ? monthRange(v).to : "") : v });
  const bad = Boolean(value.from && value.to && value.from > value.to);
  const type = monthly ? "month" : "date";

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-44">
          <Field label="From">
            <TextInput type={type} value={monthly ? value.from.slice(0, 7) : value.from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
        </div>
        <div className="w-44">
          <Field label="To">
            <TextInput
              type={type}
              value={monthly ? value.to.slice(0, 7) : value.to}
              onChange={(e) => setTo(e.target.value)}
              aria-invalid={bad}
              style={bad ? { borderColor: "var(--critical)" } : undefined}
            />
          </Field>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {presets.map((p) => {
          const r = p.range();
          const active = r.from === value.from && r.to === value.to;
          return (
            <Button key={p.id} variant={active ? "primary" : "ghost"} onClick={() => onChange(r)}>
              {p.label}
            </Button>
          );
        })}
      </div>
      {bad && <p className="mt-2 text-xs text-critical">“From” is after “To”.</p>}
    </div>
  );
}
