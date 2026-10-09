"use client";

import React, { createContext, useContext, useSyncExternalStore } from "react";
import { DB } from "./types";
import { seedDB } from "./seed";
import { commissionRateFor } from "./utils";
import { parseLegacyUnit } from "./stock";

const STORAGE_KEY = "farm-dashboard-db-v1";

// ---- external store: the browser's localStorage is the source of truth ----
let clientState: DB | null = null;
const listeners = new Set<() => void>();

/**
 * Brings saved records up to the current shape. Saves written before the
 * crop-cycle fields existed carry a flat `plantedDate`; lift it into
 * `cycle.planting` so those plots keep their date instead of losing it.
 */
function migrate(db: DB): DB {
  // Items used to count whole packs ("bag (50kg)" x 14). Stock is now held in the base
  // unit (kg / L / pcs) so a pack can be split; convert each old item once, along with
  // everything that was measured in packs: stock, minimum, cost and usage-log quantities.
  const packFactor = new Map<string, number>();
  const items = (db.items ?? []).map((i) => {
    if (i.packSize !== undefined) return { ...i, farmStock: i.farmStock ?? {} };
    const legacy = parseLegacyUnit(i.unit);
    packFactor.set(i.id, legacy.packSize);
    return {
      ...i,
      unit: legacy.unit,
      packSize: legacy.packSize,
      packLabel: legacy.packLabel,
      stock: Number((i.stock * legacy.packSize).toFixed(3)),
      minStock: Number((i.minStock * legacy.packSize).toFixed(3)),
      lastCostPerUnit: Number((i.lastCostPerUnit / legacy.packSize).toFixed(4)),
      farmStock: {},
    };
  });
  return {
    ...db,
    items,
    usageLogs: (db.usageLogs ?? []).map((u) => {
      const f = packFactor.get(u.itemId);
      return f && f !== 1 ? { ...u, quantity: Number((u.quantity * f).toFixed(3)) } : u;
    }),
    plots: (db.plots ?? []).map((p) => {
      const cycle = { ...(p.cycle ?? {}) };
      if (!cycle.planting && p.plantedDate) cycle.planting = p.plantedDate;
      // a plot used to have exactly one worker; it can now have several
      const { workerId, ...rest } = p;
      return {
        ...rest,
        workerIds: p.workerIds ?? (workerId ? [workerId] : []),
        cycle,
        history: (p.history ?? []).map((r) => {
          const { workerId: legacy, ...r2 } = r;
          return { ...r2, workerIds: r.workerIds ?? (legacy ? [legacy] : []) };
        }),
      };
    }),
    // scheduled tasks used to carry a `notes` field; it is now `remarks`
    tasks: (db.tasks ?? []).map((t) => {
      const legacy = (t as { notes?: string }).notes;
      return t.remarks || !legacy ? t : { ...t, remarks: legacy };
    }),
    // harvests saved before commissionRate was locked in per-record: back-fill
    // once from whatever Commission Settings apply today, so old saves still
    // load with a rate. Never runs again once every harvest has one.
    harvests: (db.harvests ?? []).map((h) =>
      h.commissionRate !== undefined ? h : { ...h, commissionRate: commissionRateFor(db, h.workerId, h.cropId, h.variety) }
    ),
  };
}

function load(): DB {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    // merge over the seed so saves made before a new collection existed still load
    if (raw) {
      const saved = JSON.parse(raw) as Partial<DB>;
      // wastage and allocations are user-entered only: a save that predates them starts empty, not with the demo records
      return migrate({ ...seedDB, ...saved, wastage: saved.wastage ?? [], allocations: saved.allocations ?? [] });
    }
  } catch {
    // corrupted save - fall back to the seed dataset
  }
  return seedDB;
}

function getSnapshot(): DB {
  if (clientState === null) clientState = load();
  return clientState;
}

function getServerSnapshot(): DB {
  return seedDB;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function commit(next: DB) {
  clientState = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage full (large receipt images) - keep the app usable in memory
  }
  listeners.forEach((l) => l());
}

interface StoreCtx {
  db: DB;
  setDB: (updater: (prev: DB) => DB) => void;
  update: <K extends keyof DB>(key: K, fn: (list: DB[K]) => DB[K]) => void;
  resetData: () => void;
}

const Ctx = createContext<StoreCtx | null>(null);

export function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const db = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setDB = (updater: (prev: DB) => DB) => commit(updater(getSnapshot()));

  const update: StoreCtx["update"] = (key, fn) => {
    const prev = getSnapshot();
    commit({ ...prev, [key]: fn(prev[key]) });
  };

  const resetData = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    commit(seedDB);
  };

  return <Ctx.Provider value={{ db, setDB, update, resetData }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
