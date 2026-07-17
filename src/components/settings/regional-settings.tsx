"use client";

import { Globe } from "lucide-react";
import { useId, useState } from "react";

const CURRENCY_DISPLAY_KEY = "niagaai_currency_display";
const DATE_FORMAT_KEY = "niagaai_date_format";

type CurrencyDisplay = "RM" | "MYR";
type DateFormat = "DD/MM/YYYY" | "YYYY-MM-DD";

function readStoredCurrencyDisplay(): CurrencyDisplay {
  try {
    const stored = localStorage.getItem(CURRENCY_DISPLAY_KEY);
    return stored === "MYR" ? "MYR" : "RM";
  } catch { return "RM"; }
}

function readStoredDateFormat(): DateFormat {
  try {
    const stored = localStorage.getItem(DATE_FORMAT_KEY);
    return stored === "YYYY-MM-DD" ? "YYYY-MM-DD" : "DD/MM/YYYY";
  } catch { return "DD/MM/YYYY"; }
}

export function RegionalSettings() {
  const currencySelectId = useId();
  const dateSelectId = useId();

  // Lazy initialisers read localStorage once on mount — no effect needed.
  const [currencyDisplay, setCurrencyDisplay] = useState<CurrencyDisplay>(readStoredCurrencyDisplay);
  const [dateFormat, setDateFormat] = useState<DateFormat>(readStoredDateFormat);

  function handleCurrencyChange(value: CurrencyDisplay) {
    setCurrencyDisplay(value);
    try { localStorage.setItem(CURRENCY_DISPLAY_KEY, value); } catch { /* quota */ }
  }

  function handleDateFormatChange(value: DateFormat) {
    setDateFormat(value);
    try { localStorage.setItem(DATE_FORMAT_KEY, value); } catch { /* quota */ }
  }

  const datePreview = dateFormat === "DD/MM/YYYY"
    ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date())
    : new Intl.DateTimeFormat("sv-SE", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

  return (
    <section className="settings-section" aria-labelledby="regional-title">
      <div className="settings-section-heading">
        <div>
          <p className="section-kicker">Locale</p>
          <h2 id="regional-title">Regional preferences</h2>
        </div>
        <Globe aria-hidden="true" size={18} />
      </div>

      <div className="settings-option-group">
        <label className="settings-option-label" htmlFor={currencySelectId}>Currency display</label>
        <div className="settings-select-row">
          <select
            id={currencySelectId}
            value={currencyDisplay}
            onChange={(event) => handleCurrencyChange(event.target.value as CurrencyDisplay)}
            className="settings-select"
          >
            <option value="RM">RM (local shorthand)</option>
            <option value="MYR">MYR (ISO code)</option>
          </select>
          <span className="settings-select-preview" aria-live="polite">
            Preview: {currencyDisplay} 1,250.00
          </span>
        </div>
      </div>

      <div className="settings-option-group">
        <label className="settings-option-label" htmlFor={dateSelectId}>Date format</label>
        <div className="settings-select-row">
          <select
            id={dateSelectId}
            value={dateFormat}
            onChange={(event) => handleDateFormatChange(event.target.value as DateFormat)}
            className="settings-select"
          >
            <option value="DD/MM/YYYY">DD/MM/YYYY (Malaysian)</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
          </select>
          <span className="settings-select-preview" aria-live="polite">
            Today: {datePreview}
          </span>
        </div>
      </div>

      <p className="settings-regional-note">
        These preferences will be applied to new views as they adopt the setting. Existing displays may continue using their current format.
      </p>
    </section>
  );
}
