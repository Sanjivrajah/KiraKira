import type { Invoice } from "@/types/finance";

export const INVOICES_STORAGE_KEY = "niagaai_invoices";
const invoiceStatuses = new Set(["draft", "sent", "paid", "overdue"]);
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const isBoundedString = (value: unknown, maximum: number) => typeof value === "string" && value.length <= maximum;

function isInvoice(value: unknown): value is Invoice {
  if (!value || typeof value !== "object") return false;
  const invoice = value as Record<string, unknown>;
  if (!Array.isArray(invoice.items) || invoice.items.length === 0 || invoice.items.length > 50) return false;
  const itemsAreValid = invoice.items.every((value) => {
    if (!value || typeof value !== "object") return false;
    const item = value as Record<string, unknown>;
    return isBoundedString(item.id, 120) && isBoundedString(item.description, 140) &&
      typeof item.quantity === "number" && Number.isFinite(item.quantity) && item.quantity > 0 && item.quantity <= 100_000 &&
      typeof item.unitPrice === "number" && Number.isFinite(item.unitPrice) && item.unitPrice >= 0 && item.unitPrice <= 10_000_000 &&
      typeof item.taxRate === "number" && Number.isFinite(item.taxRate) && item.taxRate >= 0 && item.taxRate <= 100;
  });
  return itemsAreValid && isBoundedString(invoice.id, 120) && isBoundedString(invoice.invoiceNumber, 40) &&
    isBoundedString(invoice.customerName, 100) && typeof invoice.issueDate === "string" && isoDatePattern.test(invoice.issueDate) &&
    typeof invoice.dueDate === "string" && isoDatePattern.test(invoice.dueDate) && invoiceStatuses.has(String(invoice.status)) &&
    typeof invoice.subtotal === "number" && Number.isFinite(invoice.subtotal) &&
    typeof invoice.tax === "number" && Number.isFinite(invoice.tax) &&
    typeof invoice.total === "number" && Number.isFinite(invoice.total) &&
    typeof invoice.createdAt === "string" && typeof invoice.updatedAt === "string";
}

function getStorage(): Storage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

function writeInvoices(invoices: Invoice[]): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try { storage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(invoices)); return true; } catch { return false; }
}

export function getInvoices(): Invoice[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(INVOICES_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    return parsed.filter((invoice): invoice is Invoice => {
      if (!isInvoice(invoice) || seen.has(invoice.id)) return false;
      seen.add(invoice.id);
      return true;
    });
  } catch { return []; }
}

export function initializeInvoices(fallback: Invoice[]): Invoice[] {
  const storage = getStorage();
  if (!storage) return fallback;
  try {
    if (storage.getItem(INVOICES_STORAGE_KEY) !== null) return getInvoices();
    return writeInvoices(fallback) ? fallback : [];
  } catch { return []; }
}

export function saveInvoice(invoice: Invoice): boolean {
  const invoices = getInvoices();
  const index = invoices.findIndex((item) => item.id === invoice.id);
  if (index >= 0) invoices[index] = invoice;
  else invoices.unshift(invoice);
  return writeInvoices(invoices);
}

export const updateInvoice = saveInvoice;

export function deleteInvoice(id: string): boolean {
  return writeInvoices(getInvoices().filter((invoice) => invoice.id !== id));
}

export function clearInvoices(): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try { storage.removeItem(INVOICES_STORAGE_KEY); return true; } catch { return false; }
}

export function makeInvoiceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `inv_${crypto.randomUUID()}`;
  return `inv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function makeInvoiceNumber(invoices = getInvoices()): string {
  const largest = invoices.reduce((max, invoice) => {
    const match = invoice.invoiceNumber.match(/(\d+)$/);
    return Math.max(max, match ? Number(match[1]) : 0);
  }, 1023);
  return `INV-${largest + 1}`;
}
