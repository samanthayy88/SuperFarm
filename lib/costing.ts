import { DB, Plot, PlotCycle, PLOT_STAGES } from "./types";
import { applicationCost, saleKg, saleTotal, todayLocalISO } from "./utils";

/**
 * Production costing by crop season.
 *
 * A "season" is one crop's run on one plot (the plot's current cycle or an
 * archived one). Costs that belong to a plot outright (commission, spray
 * rounds) are charged directly; shared costs (land rent, base salary, bills,
 * stock used farm-wide) are spread over plots by acreage so that the cost of
 * one crop is never charged to its neighbours - see `CostLine.basis`.
 */

export type CostGroup = "Workers" | "Land rental" | "Utilities & overheads" | "Farm inputs";
export const COST_GROUPS: CostGroup[] = ["Workers", "Land rental", "Utilities & overheads", "Farm inputs"];

export interface CostLine {
  group: CostGroup;
  label: string;
  amount: number;
  /** How the amount reached this plot: "Direct" or what it was allocated by. */
  basis: string;
}

export interface PlotSeason {
  key: string;
  plotId: string;
  farmId: string;
  cropId: string;
  variety?: string;
  workerIds: string[];
  start: string;
  end: string;
  ongoing: boolean;
}

export interface SeasonResult {
  lines: CostLine[];
  totalCost: number;
  harvestedKg: number;
  soldKg: number;
  /** Harvested, not sold and not written off - still in the store. */
  unsoldKg: number;
  wastedKg: number;
  /** Share of the season's cost sitting in produce that was written off. */
  wasteCost: number;
  /** Total cost spread over the kg actually sold. */
  costPerSoldKg: number;
  revenue: number;
  avgPrice: number;
  unsoldValue: number;
  costPerKg: number;
  profit: number;
  profitPerKg: number;
  /** Profit / revenue, or null when nothing has been sold. */
  margin: number | null;
}

// ---------- date helpers (ISO "YYYY-MM-DD" strings; UTC so DST can't shift a day) ----------

const DAY_MS = 86_400_000;
const ms = (iso: string) => Date.parse(iso.slice(0, 10) + "T00:00:00Z");
const inclusiveDays = (from: string, to: string) => Math.round((ms(to) - ms(from)) / DAY_MS) + 1;
const inRange = (d: string, from: string, to: string) => d >= from && d <= to;

function overlapDays(aFrom: string, aTo: string, bFrom: string, bTo: string) {
  const f = aFrom > bFrom ? aFrom : bFrom;
  const t = aTo < bTo ? aTo : bTo;
  return f > t ? 0 : inclusiveDays(f, t);
}

/** Months covered by [from, to], counting a part-month as that fraction of it. */
function monthsCovered(from: string, to: string): number {
  if (from > to) return 0;
  let total = 0;
  const end = new Date(ms(to));
  const cur = new Date(ms(from));
  cur.setUTCDate(1);
  while (cur <= end) {
    const y = cur.getUTCFullYear();
    const m = cur.getUTCMonth();
    const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const first = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
    const last = new Date(Date.UTC(y, m, dim)).toISOString().slice(0, 10);
    total += overlapDays(from, to, first, last) / dim;
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return total;
}

// ---------- seasons ----------

function cycleStart(cycle: PlotCycle): string | null {
  const dates = PLOT_STAGES.map((s) => cycle[s]).filter((d): d is string => Boolean(d));
  return dates.length ? dates.sort()[0] : null;
}

/** Every crop season on record: each plot's current cycle plus its archived ones. */
export function plotSeasons(db: DB): PlotSeason[] {
  const out: PlotSeason[] = [];
  const today = todayLocalISO();
  for (const p of db.plots) {
    const start = cycleStart(p.cycle ?? {});
    if (start) {
      const fallow = p.cycle.fallow;
      const lastDate = PLOT_STAGES.map((s) => p.cycle[s] ?? "").sort().pop() ?? start;
      out.push({
        key: `${p.id}:current`,
        plotId: p.id,
        farmId: p.farmId,
        cropId: p.cropId,
        variety: p.variety,
        workerIds: p.workerIds,
        start,
        end: fallow ?? (today > lastDate ? today : lastDate),
        ongoing: !fallow,
      });
    }
    for (const r of p.history ?? []) {
      const s = cycleStart(r.cycle ?? {});
      if (!s) continue;
      out.push({
        key: r.id,
        plotId: p.id,
        farmId: p.farmId,
        cropId: r.cropId,
        variety: r.variety,
        workerIds: r.workerIds,
        start: s,
        end: r.cycle.fallow ?? r.archivedAt,
        ongoing: false,
      });
    }
  }
  return out.sort((a, b) => b.start.localeCompare(a.start));
}

// ---------- costing ----------

/** Share of a cost pool that falls on `plot`, spreading by acreage over `pool`. */
function acreShare(plot: Plot, pool: Plot[]): number {
  const total = pool.reduce((s, p) => s + p.sizeAcres, 0);
  return total > 0 && pool.some((p) => p.id === plot.id) ? plot.sizeAcres / total : 0;
}

/** Rent accrued by a farm's contracts over [from, to] - per day under contract, whether or not paid yet. */
function farmRent(db: DB, farmId: string, from: string, to: string): number {
  return db.contracts
    .filter((c) => c.farmId === farmId)
    .reduce((s, c) => s + (overlapDays(from, to, c.startDate, c.endDate) * c.monthlyRent * 12) / 365, 0);
}

export function seasonCosting(
  db: DB,
  opts: { plotId: string; /** Omit to count every crop on the plot. */ cropId?: string; from: string; to: string; workerIds?: string[] }
): SeasonResult {
  const { plotId, cropId, from, to } = opts;
  const cropOk = (c: string) => !cropId || c === cropId;
  const plot = db.plots.find((p) => p.id === plotId);
  const empty: SeasonResult = {
    lines: [],
    totalCost: 0,
    harvestedKg: 0,
    soldKg: 0,
    unsoldKg: 0,
    wastedKg: 0,
    wasteCost: 0,
    costPerSoldKg: 0,
    revenue: 0,
    avgPrice: 0,
    unsoldValue: 0,
    costPerKg: 0,
    profit: 0,
    profitPerKg: 0,
    margin: null,
  };
  if (!plot || from > to) return empty;

  const farmPlots = db.plots.filter((p) => p.farmId === plot.farmId);
  const lines: CostLine[] = [];
  const add = (group: CostGroup, label: string, amount: number, basis: string) => lines.push({ group, label, amount, basis });

  // ---- Workers ----
  const harvests = db.harvests.filter((h) => h.plotId === plotId && cropOk(h.cropId) && inRange(h.date, from, to));
  const harvestedKg = harvests.reduce((s, h) => s + h.quantityKg, 0);
  add(
    "Workers",
    "Harvest commission",
    harvests.reduce((s, h) => s + h.quantityKg * h.commissionRate, 0),
    "Direct (locked rate on each harvest)"
  );

  const workerIds = opts.workerIds ?? plot.workerIds;
  let baseSalary = 0;
  let otherWorkerExp = 0;
  for (const wid of workerIds) {
    const w = db.workers.find((x) => x.id === wid);
    if (!w) continue;
    // a worker's salary is shared across every plot they work on (this one included)
    const pool = db.plots.filter((p) => p.workerIds.includes(wid) || p.id === plot.id);
    const share = acreShare(plot, pool);
    const effFrom = w.joinDate && w.joinDate > from ? w.joinDate : from;
    baseSalary += w.baseSalary * monthsCovered(effFrom, to) * share;
    otherWorkerExp +=
      db.workerExpenses
        .filter((e) => e.workerId === wid && !e.deductFromSalary && inRange(e.date, from, to))
        .reduce((s, e) => s + e.amount, 0) * share;
  }
  add("Workers", "Base salary", baseSalary, "Allocated by acreage across each worker's plots");
  add("Workers", "Other worker expenses (not deducted from pay)", otherWorkerExp, "Allocated by acreage across each worker's plots");

  // ---- Land rental (accrued per day the farm was under contract) ----
  const farmAcres = Math.max(db.farms.find((f) => f.id === plot.farmId)?.sizeAcres ?? 0, farmPlots.reduce((s, p) => s + p.sizeAcres, 0));
  const rent = farmRent(db, plot.farmId, from, to);
  add("Land rental", "Land rent", farmAcres > 0 ? (rent * plot.sizeAcres) / farmAcres : 0, "Allocated by plot's share of farm acreage");

  // ---- Utilities & overheads (Expenses > Payment, plus non-stock purchases) ----
  const paymentByCat = new Map<string, number>();
  for (const pay of db.payments) {
    if (!inRange(pay.date, from, to)) continue;
    const pool = pay.farmId ? db.plots.filter((p) => p.farmId === pay.farmId) : db.plots;
    const mine = pay.amount * acreShare(plot, pool);
    paymentByCat.set(pay.category, (paymentByCat.get(pay.category) ?? 0) + mine);
  }
  const cats = ["Utilities", "Rental/Office", "Transport", "Professional Fees", "Bank Charges", "Other"];
  for (const c of cats) {
    const v = paymentByCat.get(c) ?? 0;
    if (c === "Utilities" || v > 0) add("Utilities & overheads", c, v, "Allocated by acreage (farm chosen on the payment, else all farms)");
  }
  const nonStock = db.purchases
    .filter((p) => inRange(p.date, from, to))
    .flatMap((p) => p.lines)
    .filter((l) => !l.itemId || db.items.find((i) => i.id === l.itemId)?.trackInventory === false)
    .reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  add("Utilities & overheads", "Other purchases (not tracked in stock)", nonStock * acreShare(plot, db.plots), "Allocated by acreage across all farms");

  // ---- Farm inputs ----
  const sprays = db.applications
    .filter((a) => a.plotId === plotId && inRange(a.date, from, to))
    .reduce((s, a) => s + applicationCost(a), 0);
  add("Farm inputs", "Spray rounds (pesticides, fungicides, foliar)", sprays, "Direct (logged against this plot)");
  // consumables are charged when used; tools and materials are not used up, so they are charged when handed to the farm
  const durable = (cat?: string) => cat === "Tools" || cat === "Materials";
  const stockUsed = db.usageLogs
    .filter((u) => inRange(u.date, from, to))
    .reduce((s, u) => {
      const item = db.items.find((i) => i.id === u.itemId);
      if (durable(item?.category)) return s;
      const pool = u.farmId ? db.plots.filter((p) => p.farmId === u.farmId) : db.plots;
      return s + u.quantity * (item?.lastCostPerUnit ?? 0) * acreShare(plot, pool);
    }, 0);
  add("Farm inputs", "Fertilizer & other stock used", stockUsed, "Allocated by acreage (farm chosen on the usage log)");
  const toolsAllocated = (db.allocations ?? [])
    .filter((al) => al.farmId === plot.farmId && inRange(al.date, from, to) && durable(db.items.find((i) => i.id === al.itemId)?.category))
    .reduce((s, al) => s + al.quantity * al.unitCost, 0);
  add("Farm inputs", "Tools & materials given to the farm", toolsAllocated * acreShare(plot, farmPlots), "Allocated by acreage (charged when stock is allocated to the farm)");

  const totalCost = lines.reduce((s, l) => s + l.amount, 0);

  // ---- Revenue: farm's sales of this crop, split between plots by share of kg harvested ----
  const plotById = new Map(db.plots.map((p) => [p.id, p]));
  const farmCropKg = db.harvests
    .filter((h) => plotById.get(h.plotId)?.farmId === plot.farmId && cropOk(h.cropId) && inRange(h.date, from, to))
    .reduce((s, h) => s + h.quantityKg, 0);
  const kgShare = farmCropKg > 0 ? harvestedKg / farmCropKg : 0;
  const sales = db.sales.filter((s) => s.farmId === plot.farmId && cropOk(s.cropId) && inRange(s.date, from, to));
  const revenue = sales.reduce((s, x) => s + saleTotal(x), 0) * kgShare;
  const soldKg = sales.reduce((s, x) => s + saleKg(x), 0) * kgShare;
  const avgPrice = soldKg > 0 ? revenue / soldKg : 0;
  const wastedKg = (db.wastage ?? [])
    .filter((w) => w.plotId === plotId && cropOk(w.cropId) && inRange(w.date, from, to))
    .reduce((s, w) => s + w.quantityKg, 0);
  const unsoldKg = Math.max(0, harvestedKg - soldKg - wastedKg);
  const costPerKg = harvestedKg > 0 ? totalCost / harvestedKg : 0;
  const profit = revenue - totalCost;

  return {
    lines,
    totalCost,
    harvestedKg,
    soldKg,
    unsoldKg,
    wastedKg,
    wasteCost: wastedKg * costPerKg,
    costPerSoldKg: soldKg > 0 ? totalCost / soldKg : 0,
    revenue,
    avgPrice,
    unsoldValue: unsoldKg * avgPrice,
    costPerKg,
    profit,
    profitPerKg: harvestedKg > 0 ? profit / harvestedKg : 0,
    margin: revenue > 0 ? profit / revenue : null,
  };
}

// ---------- whole-farm costing ----------

export interface FarmCropRow {
  cropId: string;
  plots: string[];
  harvestedKg: number;
  soldKg: number;
  revenue: number;
  /** Cost of the plot-seasons this crop ran in (clipped to the period). */
  cost: number;
  costPerKg: number;
  profit: number;
}

export interface FarmResult {
  lines: CostLine[];
  totalCost: number;
  harvestedKg: number;
  soldKg: number;
  wastedKg: number;
  unsoldKg: number;
  revenue: number;
  profit: number;
  margin: number | null;
  costPerKg: number;
  acres: number;
  profitPerAcre: number;
  crops: FarmCropRow[];
  /** Cost not tied to a crop season: land lying fallow, gaps between crops, undated cycles. */
  idleCost: number;
}

/**
 * Profit and loss for one farm over [from, to], every crop together. Costs are
 * the sum of its plots' costs, except land rent, which is the farm's whole
 * rent - so fallow or unplanted land still weighs on the farm's result.
 */
export function farmCosting(db: DB, opts: { farmId: string; from: string; to: string }): FarmResult {
  const { farmId, from, to } = opts;
  const plots = db.plots.filter((p) => p.farmId === farmId);
  const plotIds = new Set(plots.map((p) => p.id));
  const farm = db.farms.find((f) => f.id === farmId);
  const acres = Math.max(farm?.sizeAcres ?? 0, plots.reduce((s, p) => s + p.sizeAcres, 0));

  const merged = new Map<string, CostLine>();
  if (from <= to) {
    for (const p of plots) {
      for (const l of seasonCosting(db, { plotId: p.id, from, to }).lines) {
        const key = `${l.group}|${l.label}`;
        const cur = merged.get(key);
        if (cur) cur.amount += l.amount;
        else merged.set(key, { ...l });
      }
    }
  }
  const rentKey = "Land rental|Land rent";
  const rentLine = merged.get(rentKey);
  const rent = from <= to ? farmRent(db, farmId, from, to) : 0;
  if (rentLine) {
    rentLine.amount = rent;
    rentLine.basis = "Whole farm rent, including land not planted";
  } else merged.set(rentKey, { group: "Land rental", label: "Land rent", amount: rent, basis: "Whole farm rent, including land not planted" });
  const lines = [...merged.values()];
  const totalCost = lines.reduce((s, l) => s + l.amount, 0);

  const harvests = db.harvests.filter((h) => plotIds.has(h.plotId) && inRange(h.date, from, to));
  const sales = db.sales.filter((s) => s.farmId === farmId && inRange(s.date, from, to));
  const harvestedKg = harvests.reduce((s, h) => s + h.quantityKg, 0);
  const soldKg = sales.reduce((s, x) => s + saleKg(x), 0);
  const revenue = sales.reduce((s, x) => s + saleTotal(x), 0);
  const wastedKg = (db.wastage ?? []).filter((w) => plotIds.has(w.plotId) && inRange(w.date, from, to)).reduce((s, w) => s + w.quantityKg, 0);
  const profit = revenue - totalCost;

  // crops planted in the period, each with the plots it ran on and the cost of its (clipped) seasons
  const cropIds = new Set<string>(harvests.map((h) => h.cropId));
  const seasons = plotSeasons(db).filter((s) => s.farmId === farmId && s.start <= to && s.end >= from);
  const costByCrop = new Map<string, number>();
  const plotsByCrop = new Map<string, Set<string>>();
  for (const s of seasons) {
    cropIds.add(s.cropId);
    const f = s.start > from ? s.start : from;
    const t = s.end < to ? s.end : to;
    const c = seasonCosting(db, { plotId: s.plotId, cropId: s.cropId, from: f, to: t, workerIds: s.workerIds }).totalCost;
    costByCrop.set(s.cropId, (costByCrop.get(s.cropId) ?? 0) + c);
    const names = plotsByCrop.get(s.cropId) ?? new Set<string>();
    names.add(db.plots.find((p) => p.id === s.plotId)?.name ?? "—");
    plotsByCrop.set(s.cropId, names);
  }
  for (const h of harvests) {
    const names = plotsByCrop.get(h.cropId) ?? new Set<string>();
    names.add(db.plots.find((p) => p.id === h.plotId)?.name ?? "—");
    plotsByCrop.set(h.cropId, names);
  }
  const crops: FarmCropRow[] = [...cropIds].map((cropId) => {
    const hk = harvests.filter((h) => h.cropId === cropId).reduce((s, h) => s + h.quantityKg, 0);
    const cs = sales.filter((x) => x.cropId === cropId);
    const rev = cs.reduce((s, x) => s + saleTotal(x), 0);
    const cost = costByCrop.get(cropId) ?? 0;
    return {
      cropId,
      plots: [...(plotsByCrop.get(cropId) ?? [])],
      harvestedKg: hk,
      soldKg: cs.reduce((s, x) => s + saleKg(x), 0),
      revenue: rev,
      cost,
      costPerKg: hk > 0 ? cost / hk : 0,
      profit: rev - cost,
    };
  });
  crops.sort((a, b) => b.revenue - a.revenue || b.harvestedKg - a.harvestedKg);

  return {
    lines,
    totalCost,
    harvestedKg,
    soldKg,
    wastedKg,
    unsoldKg: Math.max(0, harvestedKg - soldKg - wastedKg),
    revenue,
    profit,
    margin: revenue > 0 ? profit / revenue : null,
    costPerKg: harvestedKg > 0 ? totalCost / harvestedKg : 0,
    acres,
    profitPerAcre: acres > 0 ? profit / acres : 0,
    crops,
    idleCost: totalCost - crops.reduce((s, c) => s + c.cost, 0),
  };
}
