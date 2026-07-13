import type { InvoiceReminder } from "@/types/finance";

export const REMINDERS_STORAGE_KEY = "niagaai_reminders";

function getStorage(): Storage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

export function getReminders(): InvoiceReminder[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(REMINDERS_STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is InvoiceReminder => Boolean(item) && typeof item === "object" && typeof item.invoiceId === "string" && typeof item.remindedAt === "string");
  } catch { return []; }
}

export function markInvoiceReminded(invoiceId: string, remindedAt = new Date().toISOString()): boolean {
  const storage = getStorage();
  if (!storage) return false;
  const reminders = getReminders().filter((item) => item.invoiceId !== invoiceId);
  try { storage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify([{ invoiceId, remindedAt }, ...reminders])); return true; } catch { return false; }
}

export function deleteInvoiceReminder(invoiceId: string): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(getReminders().filter((item) => item.invoiceId !== invoiceId)));
    return true;
  } catch { return false; }
}

export function clearReminders(): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try { storage.removeItem(REMINDERS_STORAGE_KEY); return true; } catch { return false; }
}
