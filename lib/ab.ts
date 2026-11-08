import { DB, AbBatch, AbUse } from "./types";

const r3 = (n: number) => Number(n.toFixed(3));

export const AB_KG_PER_PART = 10; // one set = 10 kg of A + 10 kg of B

export function setsProduced(db: DB): number {
  return r3(db.abBatches.reduce((s, b) => s + b.sets, 0));
}
export function setsDistributed(db: DB, farmId?: string): number {
  return r3(db.abDistributions.filter((d) => !farmId || d.farmId === farmId).reduce((s, d) => s + d.sets, 0));
}
export function setsUsed(db: DB, farmId?: string): number {
  return r3(db.abUses.filter((u) => !farmId || u.farmId === farmId).reduce((s, u) => s + u.sets, 0));
}
/** Made but not yet handed to any farm. */
export function mainSets(db: DB): number {
  return r3(setsProduced(db) - setsDistributed(db));
}
/** Handed to the farm and not yet used. */
export function farmSets(db: DB, farmId: string): number {
  return r3(setsDistributed(db, farmId) - setsUsed(db, farmId));
}

/** Average cost of one set over the batches made on or before `date` (all batches if none were that early). */
export function costPerSet(db: DB, date?: string): number {
  let batches: AbBatch[] = date ? db.abBatches.filter((b) => b.date <= date) : db.abBatches;
  if (batches.length === 0) batches = db.abBatches;
  const sets = batches.reduce((s, b) => s + b.sets, 0);
  return sets > 0 ? batches.reduce((s, b) => s + b.totalCost, 0) / sets : 0;
}

export function abUseCost(db: DB, u: AbUse): number {
  return u.sets * costPerSet(db, u.date);
}

/** Convert an amount entered in `from` into the product's base unit; null when the units are not the same kind. */
export function toBase(amount: number, from: string, base: string): number | null {
  if (from === base) return amount;
  const w: Record<string, number> = { kg: 1000, g: 1 };
  const v: Record<string, number> = { L: 1000, mL: 1 };
  for (const t of [w, v]) if (t[from] && t[base]) return (amount * t[from]) / t[base];
  return null;
}

/** Units a product's amount can be keyed in: its own, plus the smaller/larger one of the same kind. */
export function unitChoices(base: string): string[] {
  if (base === "kg" || base === "g") return ["kg", "g"];
  if (base === "L" || base === "mL") return ["L", "mL"];
  return [base];
}

/** "0.01 kg" is shown as "10 g". */
export function fmtAmount(qty: number, unit: string): string {
  if (unit === "kg" && qty > 0 && qty < 1) return `${r3(qty * 1000).toLocaleString()} g`;
  if (unit === "L" && qty > 0 && qty < 1) return `${r3(qty * 1000).toLocaleString()} mL`;
  return `${r3(qty).toLocaleString()} ${unit}`;
}

/** Weight of a list of ingredients in kg (only weight units count; others are ignored). */
export function weightKg(lines: { qty: number; unit: string }[]): number {
  return r3(lines.reduce((s, l) => s + (toBase(l.qty, l.unit, "kg") ?? 0), 0));
}
