import {
  DB,
  Loan,
  RentalContract,
  SaleRecord,
  ApplicationRecord,
  Plot,
  PlotCycle,
  PlotStage,
  PLOT_STAGES,
  PLOT_STAGE_LABELS,
  WorkerHarvestTarget,
  Purchase,
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

/** An expired term that a later term on the same farm has replaced, i.e. it was renewed. */
export function isRenewed(c: RentalContract, all: RentalContract[]): boolean {
  return contractStatus(c) === "Expired" && all.some((o) => o.farmId === c.farmId && o.startDate > c.startDate);
}

/** The most recent term on a farm. */
export function latestContractForFarm(all: RentalContract[], farmId: string): RentalContract | undefined {
  return all.filter((c) => c.farmId === farmId).sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
}

/**
 * How long a farm has been rented so far: days across every term up to today,
 * with overlapping terms merged so the same day is never counted twice.
 * Null when no term has started yet.
 */
export function rentalTenure(contracts: RentalContract[]): { since: string; days: number } | null {
  const todayISO = TODAY.toISOString().slice(0, 10);
  const spans = contracts
    .map((c) => ({ s: c.startDate, e: c.endDate < todayISO ? c.endDate : todayISO }))
    .filter((x) => x.s <= x.e)
    .sort((a, b) => a.s.localeCompare(b.s));
  if (spans.length === 0) return null;
  const merged = [spans[0]];
  for (const x of spans.slice(1)) {
    const last = merged[merged.length - 1];
    if (x.s <= last.e) last.e = x.e > last.e ? x.e : last.e;
    else merged.push({ ...x });
  }
  return { since: merged[0].s, days: merged.reduce((sum, x) => sum + daysBetween(x.s, x.e) + 1, 0) };
}

/** 999 days → "2 yrs 8 mos". */
export function fmtDuration(days: number): string {
  // 0.1 month (~3 days) of slack so a term ending on a month's last day isn't rounded down a month
  const months = Math.floor(days / 30.4375 + 0.1);
  if (months < 1) return `${days} day${days === 1 ? "" : "s"}`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y ? `${y} yr${y === 1 ? "" : "s"}` : "", m ? `${m} mo${m === 1 ? "" : "s"}` : ""].filter(Boolean).join(" ");
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

// ---------- Harvest ↔ sale stock (so kg isn't typed twice) ----------

/** Total kg ever harvested for a crop, across all plots and dates. */
export function totalHarvestedKg(db: DB, cropId: string): number {
  return db.harvests.filter((h) => h.cropId === cropId).reduce((s, h) => s + h.quantityKg, 0);
}

/** Total kg ever sold for a crop, across all sales and grades. */
export function totalSoldKg(db: DB, cropId: string): number {
  return db.sales.filter((s) => s.cropId === cropId).reduce((s, x) => s + saleKg(x), 0);
}

/** Harvested but not yet sold, for a crop. Can go negative if oversold. */
export function pendingStockKg(db: DB, cropId: string): number {
  return totalHarvestedKg(db, cropId) - totalSoldKg(db, cropId);
}

// ---------- Worker commission settings ----------

/**
 * Effective RM/kg for one worker's harvest on a given plot+crop(+variety).
 * Prefers a worker-level WorkerCommissionSetting matching the exact variety,
 * then one set for "any variety" on that plot, before falling back to the
 * crop's global `commissionRatePerKg`.
 */
export function commissionRateFor(
  db: DB,
  workerId: string,
  plotId: string,
  cropId: string,
  variety?: string
): number {
  const settings = db.commissionSettings.filter(
    (s) => s.workerId === workerId && s.plotId === plotId && s.cropId === cropId
  );
  const exact = variety ? settings.find((s) => s.variety === variety) : undefined;
  const anyVariety = settings.find((s) => !s.variety);
  const match = exact ?? anyVariety;
  if (match) return match.ratePerKg;
  return db.crops.find((c) => c.id === cropId)?.commissionRatePerKg ?? 0;
}

// ---------- Worker harvest targets ----------

/** Total kg harvested by this target's worker on its farm/plot/crop(/variety) within its date range. */
export function harvestTargetActualKg(db: DB, target: WorkerHarvestTarget): number {
  return db.harvests
    .filter(
      (h) =>
        h.workerId === target.workerId &&
        h.plotId === target.plotId &&
        h.cropId === target.cropId &&
        h.date >= target.startDate &&
        h.date <= target.endDate &&
        (!target.variety || h.variety === target.variety)
    )
    .reduce((s, h) => s + h.quantityKg, 0);
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
      const byCrop = new Map<string, typeof harvests>();
      for (const h of harvests) byCrop.set(h.cropId, [...(byCrop.get(h.cropId) ?? []), h]);
      const commissionByCrop = [...byCrop.entries()].map(([cropId, list]) => {
        const kg = list.reduce((s, h) => s + h.quantityKg, 0);
        const amount = list.reduce(
          (s, h) => s + h.quantityKg * commissionRateFor(db, w.id, h.plotId, cropId, h.variety),
          0
        );
        return { cropId, kg, rate: kg > 0 ? amount / kg : 0, amount };
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

// ---------- Purchases ----------
export function purchaseTotal(p: Purchase): number {
  return p.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
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
export function cycleSteps(cycle: PlotCycle): CycleStep[] {
  const c = cycle ?? {};
  const filled = PLOT_STAGES.filter((s) => c[s]).map((s) => ({
    stage: s,
    label: PLOT_STAGE_LABELS[s],
    date: c[s] as string,
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
export function cycleDurationDays(cycle: PlotCycle): number | null {
  const steps = cycleSteps(cycle);
  if (steps.length < 2) return null;
  return daysBetween(steps[0].date, steps[steps.length - 1].date);
}

/** Days from the first recorded stage until today — for a cycle still running. */
export function cycleDaysSoFar(cycle: PlotCycle): number | null {
  const steps = cycleSteps(cycle);
  if (steps.length === 0) return null;
  return Math.max(0, daysBetween(steps[0].date, TODAY));
}

/** The latest stage whose date has already passed. */
export function currentStage(cycle: PlotCycle): CycleStep | null {
  const past = cycleSteps(cycle).filter((s) => new Date(s.date) <= TODAY);
  return past.length > 0 ? past[past.length - 1] : null;
}

/** The next stage still in the future, if any. */
export function nextStage(cycle: PlotCycle): CycleStep | null {
  return cycleSteps(cycle).find((s) => new Date(s.date) > TODAY) ?? null;
}

/**
 * Average completed-cycle length per crop, across both the plots' current
 * cycle (if it reached fallow) and every archived cycle in their history.
 */
export function averageCycleDaysByCrop(plots: Plot[], cropId: string): number | null {
  const lengths: number[] = [];
  for (const p of plots) {
    if (p.cropId === cropId && p.cycle?.fallow) {
      const d = cycleDurationDays(p.cycle);
      if (d !== null) lengths.push(d);
    }
    for (const h of p.history ?? []) {
      if (h.cropId === cropId && h.cycle?.fallow) {
        const d = cycleDurationDays(h.cycle);
        if (d !== null) lengths.push(d);
      }
    }
  }
  if (lengths.length === 0) return null;
  return Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
}
