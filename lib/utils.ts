import {
  DB,
  Loan,
  RentalContract,
  SaleRecord,
  ApplicationRecord,
  Plot,
  PlotStage,
  PLOT_STAGES,
  PLOT_STAGE_LABELS,
} from "./types";

export const TODAY = new Date();

export function fmtRM(n: number) {
  return `RM ${n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtRM0(n: number) {
  return `RM ${n.toLocaleString("en-MY", { maximumFractionDigits: 0 })}`;
}

export function fmtDate(iso: string) {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
}

export function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-MY", { month: "short", year: "numeric" });
}

export function currentMonthKey() {
  return monthKey(TODAY);
}

export function lastNMonthKeys(n: number, from = TODAY) {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    keys.push(monthKey(new Date(from.getFullYear(), from.getMonth() - i, 1)));
  }
  return keys;
}

export function daysBetween(a: string | Date, b: string | Date) {
  const da = typeof a === "string" ? new Date(a) : a;
  const db = typeof b === "string" ? new Date(b) : b;
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

// ---------- Contracts ----------
export type ContractStatus = "Active" | "Expiring Soon" | "Expired";

export function contractStatus(c: RentalContract): ContractStatus {
  const end = new Date(c.endDate);
  if (end < TODAY) return "Expired";
  if (daysBetween(TODAY, end) <= 90) return "Expiring Soon";
  return "Active";
}

/** Months since contract start (or Jan this year) up to current month that are unpaid */
export function unpaidRentMonths(c: RentalContract): string[] {
  const start = new Date(c.startDate);
  const end = new Date(c.endDate) < TODAY ? new Date(c.endDate) : TODAY;
  const first = new Date(Math.max(start.getTime(), new Date(TODAY.getFullYear(), 0, 1).getTime()));
  const out: string[] = [];
  const cur = new Date(first.getFullYear(), first.getMonth(), 1);
  while (cur <= end) {
    const k = monthKey(cur);
    if (!c.paidMonths.includes(k)) out.push(k);
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

// ---------- Loans ----------
export function loanMonthsElapsed(l: Loan): string[] {
  const start = new Date(l.startDate);
  const out: string[] = [];
  const cur = new Date(Math.max(start.getTime(), new Date(TODAY.getFullYear(), 0, 1).getTime()));
  cur.setDate(1);
  const endOfTenure = new Date(start.getFullYear(), start.getMonth() + l.tenureMonths, 1);
  const stop = endOfTenure < TODAY ? endOfTenure : TODAY;
  while (cur <= stop) {
    out.push(monthKey(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

export function unpaidLoanMonths(l: Loan): string[] {
  return loanMonthsElapsed(l).filter((m) => !l.paidMonths.includes(m));
}

export function loanBalance(l: Loan): number {
  return Math.max(0, l.principal - l.paidMonths.length * l.monthlyInstallment);
}

// ---------- Sales ----------
export function saleTotal(s: SaleRecord): number {
  return s.grades.reduce((sum, g) => sum + g.quantityKg * g.pricePerKg, 0);
}

export function saleKg(s: SaleRecord): number {
  return s.grades.reduce((sum, g) => sum + g.quantityKg, 0);
}

export function saleDueDate(s: SaleRecord, termDays: number): Date {
  const d = new Date(s.date);
  d.setDate(d.getDate() + termDays);
  return d;
}

export function saleOverdueDays(s: SaleRecord, termDays: number): number {
  if (s.paymentStatus === "Received") return 0;
  return Math.max(0, daysBetween(saleDueDate(s, termDays), TODAY));
}

// ---------- Payroll ----------
export interface PayrollLine {
  workerId: string;
  baseSalary: number;
  commissionByCrop: { cropId: string; kg: number; rate: number; amount: number }[];
  commissionTotal: number;
  deductions: { id: string; date: string; type: string; description: string; amount: number }[];
  deductionTotal: number;
  netPay: number;
}

export function computePayroll(db: DB, month: string): PayrollLine[] {
  return db.workers
    .filter((w) => w.active)
    .map((w) => {
      const harvests = db.harvests.filter(
        (h) => h.workerId === w.id && h.date.startsWith(month)
      );
      const byCrop = new Map<string, number>();
      for (const h of harvests) byCrop.set(h.cropId, (byCrop.get(h.cropId) ?? 0) + h.quantityKg);
      const commissionByCrop = [...byCrop.entries()].map(([cropId, kg]) => {
        const rate = db.crops.find((c) => c.id === cropId)?.commissionRatePerKg ?? 0;
        return { cropId, kg, rate, amount: kg * rate };
      });
      const commissionTotal = commissionByCrop.reduce((s, c) => s + c.amount, 0);
      const deductions = db.workerExpenses
        .filter((e) => e.workerId === w.id && e.deductFromSalary && e.date.startsWith(month))
        .map((e) => ({ id: e.id, date: e.date, type: e.type, description: e.description, amount: e.amount }));
      const deductionTotal = deductions.reduce((s, d) => s + d.amount, 0);
      return {
        workerId: w.id,
        baseSalary: w.baseSalary,
        commissionByCrop,
        commissionTotal,
        deductions,
        deductionTotal,
        netPay: w.baseSalary + commissionTotal - deductionTotal,
      };
    });
}

// ---------- Applications ----------
export function applicationCost(a: ApplicationRecord): number {
  return a.products.reduce((s, p) => s + p.quantityUsed * p.unitCost, 0);
}

// ---------- Plot crop cycle ----------

export interface CycleStep {
  stage: PlotStage;
  label: string;
  date: string;
  /** days since the previous recorded stage; null for the first one */
  daysFromPrev: number | null;
}

/** The stages that actually have a date, in field order, with gaps between them. */
export function cycleSteps(plot: Plot): CycleStep[] {
  const cycle = plot.cycle ?? {};
  const filled = PLOT_STAGES.filter((s) => cycle[s]).map((s) => ({
    stage: s,
    label: PLOT_STAGE_LABELS[s],
    date: cycle[s] as string,
  }));
  return filled.map((step, i) => ({
    ...step,
    daysFromPrev: i === 0 ? null : daysBetween(filled[i - 1].date, step.date),
  }));
}

/**
 * Total cycle length in days: first recorded stage to last recorded stage.
 * Null when fewer than two stages have dates.
 */
export function cycleDurationDays(plot: Plot): number | null {
  const steps = cycleSteps(plot);
  if (steps.length < 2) return null;
  return daysBetween(steps[0].date, steps[steps.length - 1].date);
}

/** Days from the first recorded stage until today — for a cycle still running. */
export function cycleDaysSoFar(plot: Plot): number | null {
  const steps = cycleSteps(plot);
  if (steps.length === 0) return null;
  return Math.max(0, daysBetween(steps[0].date, TODAY));
}

/** The latest stage whose date has already passed. */
export function currentStage(plot: Plot): CycleStep | null {
  const past = cycleSteps(plot).filter((s) => new Date(s.date) <= TODAY);
  return past.length > 0 ? past[past.length - 1] : null;
}

/** The next stage still in the future, if any. */
export function nextStage(plot: Plot): CycleStep | null {
  return cycleSteps(plot).find((s) => new Date(s.date) > TODAY) ?? null;
}

/** Average completed-cycle length per crop, across plots that reached fallow. */
export function averageCycleDaysByCrop(plots: Plot[], cropId: string): number | null {
  const lengths = plots
    .filter((p) => p.cropId === cropId && p.cycle?.fallow)
    .map((p) => cycleDurationDays(p))
    .filter((d): d is number => d !== null);
  if (lengths.length === 0) return null;
  return Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
}
