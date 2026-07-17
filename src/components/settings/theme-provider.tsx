"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, useState, type ReactNode } from "react";

export type ThemePreference = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "niagaai_theme";

interface ThemeContextValue {
  theme: ThemePreference;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch { /* localStorage unavailable */ }
  return "light";
}

function applyThemeToDOM(preference: ThemePreference, systemIsDark: boolean): "light" | "dark" {
  const resolved = preference === "system" ? (systemIsDark ? "dark" : "light") : preference;
  document.documentElement.setAttribute("data-theme", resolved);
  return resolved;
}

// ── System theme via useSyncExternalStore ──

let cachedSystemIsDark = false;

function subscribeSystemTheme(onStoreChange: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => {
    cachedSystemIsDark = mq.matches;
    onStoreChange();
  };
  cachedSystemIsDark = mq.matches;
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}

function getSystemIsDarkSnapshot() { return cachedSystemIsDark; }
function getServerSnapshot() { return false; }

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemIsDark = useSyncExternalStore(subscribeSystemTheme, getSystemIsDarkSnapshot, getServerSnapshot);

  // Lazy initialiser reads localStorage once on mount — no effect needed.
  const [theme, setThemeState] = useState<ThemePreference>(readStoredTheme);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* quota or private browsing */ }
  }, []);

  // Synchronise the data-theme attribute on <html> whenever inputs change.
  // This is the correct use of an effect: updating an external system (the DOM).
  useEffect(() => {
    applyThemeToDOM(theme, systemIsDark);
  }, [theme, systemIsDark]);

  const resolvedTheme = theme === "system" ? (systemIsDark ? "dark" : "light") : theme;

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used within ThemeProvider.");
  return value;
}
