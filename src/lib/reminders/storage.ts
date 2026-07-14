import type { Invoice, Reminder } from "@/types";

export const REMINDERS_STORAGE_KEY = "niagaai_reminders";

function getStorage(): Storage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

function migrateReminder(value: unknown): Reminder | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (typeof item.invoiceId !== "string") return null;
  const sentAt = typeof item.sentAt === "string" ? item.sentAt : typeof item.remindedAt === "string" ? item.remindedAt : null;
  if (!sentAt) return null;
  return {
    id: typeof item.id === "string" ? item.id : `reminder_${item.invoiceId}`,
    businessId: typeof item.businessId === "string" ? item.businessId : "business_demo",
    invoiceId: item.invoiceId,
    recipient: typeof item.recipient === "string" ? item.recipient : "",
    messagePreview: typeof item.messagePreview === "string" ? item.messagePreview : null,
    templateKey: typeof item.templateKey === "string" ? item.templateKey : null,
    channel: item.channel === "email" || item.channel === "sms" || item.channel === "whatsapp" ? item.channel : "manual",
    status: "sent",
    scheduledAt: null,
    sentAt,
    createdAt: typeof item.createdAt === "string" ? item.createdAt : sentAt,
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : sentAt,
  };
}

export function getReminders(): Reminder[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(REMINDERS_STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.map(migrateReminder).filter((item): item is Reminder => item !== null);
  } catch { return []; }
}

export function markInvoiceReminded(
  invoice: Pick<Invoice, "id" | "businessId" | "customerName" | "customerEmail">,
  messagePreview: string,
  sentAt = new Date().toISOString(),
): boolean {
  const storage = getStorage();
  if (!storage) return false;
  const reminders = getReminders().filter((item) => item.invoiceId !== invoice.id);
  const reminder: Reminder = {
    id: `reminder_${invoice.id}`,
    businessId: invoice.businessId,
    invoiceId: invoice.id,
    recipient: invoice.customerEmail || invoice.customerName,
    messagePreview,
    templateKey: null,
    channel: "manual",
    status: "sent",
    scheduledAt: null,
    sentAt,
    createdAt: sentAt,
    updatedAt: sentAt,
  };
  try { storage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify([reminder, ...reminders])); return true; } catch { return false; }
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
