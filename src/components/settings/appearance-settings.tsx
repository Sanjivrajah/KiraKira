"use client";

import { Moon, Sun, Monitor, Rows3, Rows4 } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useTheme, type ThemePreference } from "./theme-provider";

const DENSITY_STORAGE_KEY = "niagaai_density";
type Density = "comfortable" | "compact";

function readStoredDensity(): Density {
  try {
    const stored = localStorage.getItem(DENSITY_STORAGE_KEY);
    return stored === "compact" ? "compact" : "comfortable";
  } catch { return "comfortable"; }
}

function subscribeToHydration() { return () => undefined; }
function getHydratedSnapshot() { return true; }
function getServerHydrationSnapshot() { return false; }

const themeOptions: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

const densityOptions: { value: Density; label: string; icon: typeof Rows3 }[] = [
  { value: "comfortable", label: "Comfortable", icon: Rows3 },
  { value: "compact", label: "Compact", icon: Rows4 },
];

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const hasHydrated = useSyncExternalStore(subscribeToHydration, getHydratedSnapshot, getServerHydrationSnapshot);

  // Keep the first client render deterministic, then read this device setting.
  const [requestedDensity, setDensity] = useState<Density>("comfortable");
  const density = hasHydrated ? readStoredDensity() : requestedDensity;

  // Synchronise data-density attribute on <html> — an external-system effect.
  useEffect(() => {
    if (density === "compact") {
      document.documentElement.setAttribute("data-density", "compact");
    } else {
      document.documentElement.removeAttribute("data-density");
    }
  }, [density]);

  function handleDensity(next: Density) {
    setDensity(next);
    try { localStorage.setItem(DENSITY_STORAGE_KEY, next); } catch { /* quota */ }
  }

  return (
    <section className="settings-section" aria-labelledby="appearance-title">
      <div className="settings-section-heading">
        <div>
          <p className="section-kicker">Personalisation</p>
          <h2 id="appearance-title">Appearance</h2>
        </div>
      </div>

      <div className="settings-option-group">
        <label className="settings-option-label">Theme</label>
        <div className="settings-toggle-group" role="radiogroup" aria-label="Theme preference">
          {themeOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={theme === value}
              className={`settings-toggle-item${theme === value ? " is-active" : ""}`}
              onClick={() => setTheme(value)}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-option-group">
        <label className="settings-option-label">Display density</label>
        <div className="settings-toggle-group" role="radiogroup" aria-label="Display density">
          {densityOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={density === value}
              className={`settings-toggle-item${density === value ? " is-active" : ""}`}
              onClick={() => handleDensity(value)}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
