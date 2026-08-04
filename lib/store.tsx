"use client";

import React, { createContext, useContext, useSyncExternalStore } from "react";
import { DB } from "./types";
import { seedDB } from "./seed";

const STORAGE_KEY = "farm-dashboard-db-v1";

// ---- external store: the browser's localStorage is the source of truth ----
let clientState: DB | null = null;
const listeners = new Set<() => void>();

function load(): DB {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    // merge over the seed so saves made before a new collection existed still load
    if (raw) return { ...seedDB, ...(JSON.parse(raw) as Partial<DB>) };
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
