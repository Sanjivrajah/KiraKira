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
  return <section className="settings-export-card" aria-labelledby="export-title"><div><h3 id="export-title">Export local transactions</h3><p>Download browser-local transaction data when preparing a deliberate migration. Nothing is uploaded or imported.</p></div><div className="settings-export-actions"><button type="button" onClick={download} className="button button-secondary">Export data</button>{message ? <p role="status">{message}</p> : null}</div></section>;
}
