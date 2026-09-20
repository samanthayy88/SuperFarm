"use client";

import React, { createContext, useCallback, useContext, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "farm-dashboard-theme";

/**
 * Runs before first paint (injected into <head> as a blocking script) so the
 * correct theme is on <html> before anything renders — no flash of the wrong
 * theme, and no hydration mismatch, since the server never guesses a theme.
 */
export const themeInitScript = `(function(){try{
var s=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
var t=(s==="light"||s==="dark")?s:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");
document.documentElement.setAttribute("data-theme",t);
}catch(e){document.documentElement.setAttribute("data-theme","light");}})();`;

// --- external store over the <html data-theme> attribute -------------------
const listeners = new Set<() => void>();

function current(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function apply(next: Theme) {
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // private mode / blocked storage — theme still applies for this session
  }
  listeners.forEach((l) => l());
}

interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // server renders "light"; the init script has already set the real value on
  // the client, so the first client snapshot reads the true theme.
  const theme = useSyncExternalStore(subscribe, current, () => "light" as Theme);

  const setTheme = useCallback((t: Theme) => apply(t), []);
  const toggle = useCallback(() => apply(current() === "dark" ? "light" : "dark"), []);

  return <Ctx.Provider value={{ theme, toggle, setTheme }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
