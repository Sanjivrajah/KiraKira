"use client";

import { BROWSER_LOCAL_EXPORT_VERSION, type BrowserLocalExport } from "./browser-local";
import { STORAGE_KEYS } from "@/lib/storage/storage-keys";

/** Creates a portable payload only when a person explicitly requests an export. */
export function createBrowserLocalTransactionExport(storage: Pick<Storage, "getItem"> = window.localStorage): BrowserLocalExport {
  const raw = storage.getItem(STORAGE_KEYS.transactions);
  let records: unknown[] = [];
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) records = parsed;
    } catch {
      // Preserve no malformed data silently: the import report can only assess exported records.
      records = [];
    }
  }
  return { schemaVersion: BROWSER_LOCAL_EXPORT_VERSION, exportId: crypto.randomUUID(), exportedAt: new Date().toISOString(), records };
}
