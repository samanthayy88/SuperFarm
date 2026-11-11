"use client";

import React, { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import { DB } from "./types";
import { seedDB } from "./seed";
import { commissionRateFor } from "./utils";
import { parseLegacyUnit } from "./stock";
import { syncAbItem } from "./ab";
import LoginScreen from "@/components/LoginScreen";

const STORAGE_KEY = "farm-dashboard-db-v1";

// ---- external store: the online database (through /api/data) is the source of truth; localStorage is used only when the server is not set up ----
let clientState: DB | null = null;
const listeners = new Set<() => void>();

type Status = "loading" | "locked" | "ready" | "error";
interface Meta {
  status: Status;
  /** "server" = shared online database; "local" = this browser only (server not configured). */
  mode: "server" | "local";
  /** Last change has not reached the server yet. */
  unsaved: boolean;
  offline: boolean;
  notice: string;
}
let meta: Meta = { status: "loading", mode: "server", unsaved: false, offline: false, notice: "" };
const setMeta = (patch: Partial<Meta>) => {
  meta = { ...meta, ...patch };
  listeners.forEach((l) => l());
};
let version = 0; // version of the server copy this browser last saw

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
  // purchase lines now carry their own pack size, so a later change to an item's pack can't
  // alter what an old purchase added: fix each existing line to what its item was at that point
  const itemById = new Map(items.map((i) => [i.id, i]));
  const purchases = (db.purchases ?? []).map((p) => ({
    ...p,
    lines: p.lines.map((l) => {
      const it = l.itemId ? itemById.get(l.itemId) : undefined;
      if (!it || l.packSize !== undefined) return l;
      return { ...l, uom: l.uom ?? it.packLabel ?? it.unit, packSize: it.packSize ?? 1, packUnit: it.unit, category: l.category ?? it.category };
    }),
  }));
  return {
    ...db,
    items,
    purchases,
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

/** Turn whatever was saved (any older shape) into a full, current DB. */
function fromSaved(saved: Partial<DB>): DB {
  // wastage and allocations are user-entered only: a save that predates them starts empty, not with the demo records
  return migrate({ ...seedDB, ...saved, wastage: saved.wastage ?? [], allocations: saved.allocations ?? [] });
}

function loadLocal(): DB {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return fromSaved(JSON.parse(raw) as Partial<DB>);
  } catch {
    // corrupted save - fall back to the seed dataset
  }
  return seedDB;
}

function getSnapshot(): DB {
  return clientState ?? seedDB;
}
function getServerSnapshot(): DB {
  return seedDB;
}
const getMeta = () => meta;
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// ---------- saving to the server ----------
let saving = false;
let timer: ReturnType<typeof setTimeout> | undefined;

function scheduleSave(delay = 600) {
  setMeta({ unsaved: true });
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, delay);
}

async function flush() {
  if (saving || !clientState || meta.mode !== "server") return;
  saving = true;
  const sent = clientState;
  try {
    const res = await fetch("/api/data", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: sent, baseVersion: version }),
    });
    if (res.ok) {
      version = (await res.json()).version;
      setMeta({ offline: false, unsaved: clientState !== sent });
      saving = false;
      if (clientState !== sent) void flush();
      return;
    }
    if (res.status === 401) {
      saving = false;
      setMeta({ status: "locked" });
      return;
    }
    if (res.status === 409) {
      // another device saved first: take its copy so nothing is silently overwritten
      const cur = await res.json();
      version = cur.version;
      clientState = cur.data ? fromSaved(cur.data) : seedDB;
      setMeta({ unsaved: false, offline: false, notice: "Another device changed the data first, so your last change was not saved. Please check and redo it." });
      saving = false;
      return;
    }
    throw new Error(`save failed (${res.status})`);
  } catch {
    saving = false;
    setMeta({ offline: true, unsaved: true });
    timer = setTimeout(flush, 5000); // keep trying
  }
}

function commit(raw: DB) {
  // the AB Fertilizers stock item always mirrors the AB sets, whichever page changed the data
  const next = syncAbItem(raw);
  clientState = next;
  if (meta.mode === "local") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // storage full - keep the app usable in memory
    }
    listeners.forEach((l) => l());
  } else {
    listeners.forEach((l) => l());
    scheduleSave();
  }
}

// ---------- loading from the server ----------
async function bootstrap() {
  setMeta({ status: "loading" });
  try {
    const res = await fetch("/api/data", { cache: "no-store" });
    if (res.status === 503) {
      // no online database configured: behave as before, saving in this browser only
      clientState = loadLocal();
      setMeta({ status: "ready", mode: "local" });
      return;
    }
    if (res.status === 401) {
      setMeta({ status: "locked", mode: "server" });
      return;
    }
    if (!res.ok) throw new Error(String(res.status));
    const body = await res.json();
    version = body.version;
    clientState = body.data ? fromSaved(body.data) : seedDB;
    setMeta({ status: "ready", mode: "server", offline: false, notice: "" });
    if (!body.data) scheduleSave(0); // very first run: store the starting data
  } catch {
    setMeta({ status: "error" });
  }
}

/** Pick up changes made on another device (when this one is idle and visible again). */
async function refresh() {
  if (meta.status !== "ready" || meta.mode !== "server" || saving || meta.unsaved) return;
  try {
    const res = await fetch("/api/data", { cache: "no-store" });
    if (res.status === 401) return setMeta({ status: "locked" });
    if (!res.ok) return;
    const body = await res.json();
    if (body.version > version && !meta.unsaved) {
      version = body.version;
      clientState = body.data ? fromSaved(body.data) : seedDB;
      listeners.forEach((l) => l());
    }
  } catch {
    // offline: try again next time
  }
}

interface StoreCtx {
  db: DB;
  setDB: (updater: (prev: DB) => DB) => void;
  update: <K extends keyof DB>(key: K, fn: (list: DB[K]) => DB[K]) => void;
  resetData: () => void;
  /** Signs out; only meaningful with the shared online database. */
  logout: () => void;
  mode: "server" | "local";
}

const Ctx = createContext<StoreCtx | null>(null);

export function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

let started = false;

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const db = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const m = useSyncExternalStore(subscribe, getMeta, getMeta);

  useEffect(() => {
    if (!started) {
      started = true;
      void bootstrap();
    }
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    const poll = setInterval(() => document.visibilityState === "visible" && void refresh(), 45000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(poll);
    };
  }, []);

  const setDB = (updater: (prev: DB) => DB) => commit(updater(getSnapshot()));

  const update: StoreCtx["update"] = (key, fn) => {
    const prev = getSnapshot();
    commit({ ...prev, [key]: fn(prev[key]) });
  };

  const resetData = () => {
    if (meta.mode === "local") {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    commit(seedDB);
  };

  const logout = () => {
    void fetch("/api/logout", { method: "POST" }).finally(() => {
      clientState = null;
      version = 0;
      setMeta({ status: "locked", unsaved: false, notice: "" });
    });
  };

  if (m.status === "locked") return <LoginScreen onSuccess={() => void bootstrap()} />;
  if (m.status === "loading" || m.status === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        {m.status === "loading" ? (
          <p className="text-sm text-muted">Loading your farm data…</p>
        ) : (
          <>
            <p className="text-base text-ink">Can&apos;t reach the server.</p>
            <p className="text-sm text-muted">Check your internet connection and try again.</p>
            <button onClick={() => void bootstrap()} className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-on-accent">
              Try again
            </button>
          </>
        )}
      </div>
    );
  }

  const banner = m.notice
    ? { tone: "warn", text: m.notice }
    : m.offline
      ? { tone: "warn", text: "No connection — your changes are kept here and will save when you are back online." }
      : m.mode === "local"
        ? { tone: "info", text: "Online database not set up: data is saved on this device only." }
        : null;

  return (
    <Ctx.Provider value={{ db, setDB, update, resetData, logout, mode: m.mode }}>
      {children}
      {banner && (
        <div
          role="status"
          className={`no-print fixed inset-x-3 bottom-3 z-[60] flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-pop lg:left-72 ${
            banner.tone === "warn" ? "border-warning/40 bg-warning-soft text-ink" : "border-hairline bg-surface text-ink-2"
          }`}
        >
          <span className="flex-1">{banner.text}</span>
          {m.notice && (
            <button onClick={() => setMeta({ notice: "" })} className="shrink-0 font-medium text-accent" aria-label="Dismiss">
              OK
            </button>
          )}
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
