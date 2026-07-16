"use client";

import { useState } from "react";
import { createBrowserLocalTransactionExport } from "@/lib/data-migration/browser-export";

export function BrowserLocalExport() {
  const [message, setMessage] = useState<string | null>(null);
  function download() {
    const payload = createBrowserLocalTransactionExport();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `niagaai-browser-export-${payload.exportId}.json`;
    link.click();
    URL.revokeObjectURL(href);
    setMessage(`Exported ${payload.records.length} transaction record${payload.records.length === 1 ? "" : "s"}. Import is a separate preview-and-commit operation.`);
  }
  return <section className="rounded-lg border border-slate-200 p-4"><h2 className="text-base font-semibold">Development data export</h2><p className="mt-1 text-sm text-slate-600">Export browser-local transaction data only when preparing a deliberate migration. This does not upload or import anything.</p><button type="button" onClick={download} className="mt-3 min-h-11 rounded-md bg-slate-900 px-4 text-sm font-medium text-white">Export local transactions</button>{message ? <p role="status" className="mt-2 text-sm text-slate-600">{message}</p> : null}</section>;
}
