import { InventoryItem } from "./types";

/**
 * Stock is counted in base units (kg, L, pcs). `item.stock` is the total on
 * hand; `item.farmStock` is the part of it handed to each farm; whatever is
 * left over is the Main balance, still unallocated.
 */

const r3 = (n: number) => Number(n.toFixed(3));

export function packSizeOf(item: InventoryItem): number {
  return item.packSize && item.packSize > 0 ? item.packSize : 1;
}

export function farmBalance(item: InventoryItem, farmId: string): number {
  return item.farmStock?.[farmId] ?? 0;
}

export function allocatedTotal(item: InventoryItem): number {
  return Object.values(item.farmStock ?? {}).reduce((s, v) => s + v, 0);
}

/** Total stock not yet given to any farm. */
export function mainBalance(item: InventoryItem): number {
  return Math.max(0, r3(item.stock - allocatedTotal(item)));
}

/** "50 kg" - and "(2 bags)" when stock is bought in packs. */
export function fmtStock(item: InventoryItem, qty: number): string {
  const n = r3(qty);
  const pack = packSizeOf(item);
  const base = `${n.toLocaleString()} ${item.unit}`;
  if (pack > 1 && item.packLabel) {
    const packs = r3(n / pack);
    return `${base} (${packs.toLocaleString()} ${item.packLabel}${packs === 1 ? "" : "s"})`;
  }
  return base;
}

/** Stock after using `qty` at a farm: that farm's own share goes first, any shortfall comes out of Main. */
export function consumeStock(item: InventoryItem, farmId: string | undefined, qty: number): InventoryItem {
  if (qty <= 0) return item;
  const own = farmId ? farmBalance(item, farmId) : 0;
  const fromFarm = Math.min(own, qty);
  const farmStock = { ...(item.farmStock ?? {}) };
  if (farmId && fromFarm > 0) farmStock[farmId] = r3(own - fromFarm);
  return { ...item, stock: Math.max(0, r3(item.stock - qty)), farmStock };
}

/** Move `qty` between Main (`null`) and/or farms; returns the item unchanged if the source lacks the stock. */
export function transferStock(item: InventoryItem, from: string | null, to: string | null, qty: number): InventoryItem {
  if (qty <= 0 || from === to) return item;
  const farmStock = { ...(item.farmStock ?? {}) };
  const available = from === null ? mainBalance(item) : farmBalance(item, from);
  if (qty > available + 1e-9) return item;
  if (from !== null) farmStock[from] = r3(farmBalance(item, from) - qty);
  if (to !== null) farmStock[to] = r3(farmBalance(item, to) + qty);
  return { ...item, farmStock };
}

/** Old items counted whole packs and named them like "bag (50kg)"; read that back into a base unit and pack size. */
export function parseLegacyUnit(unit: string): { unit: string; packSize: number; packLabel?: string } {
  const m = unit.trim().match(/^(.+?)\s*\(\s*(\d+(?:\.\d+)?)\s*([a-zA-Z]+)\s*\)$/);
  if (m) {
    const base = m[3].toLowerCase() === "l" ? "L" : m[3].toLowerCase();
    return { unit: base, packSize: Number(m[2]), packLabel: m[1].trim() };
  }
  return { unit: unit.trim() || "pcs", packSize: 1 };
}
