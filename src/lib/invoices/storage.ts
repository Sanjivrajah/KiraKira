import type { Invoice, InvoiceLineItem, InvoiceStatus } from "@/types";

export const INVOICES_STORAGE_KEY = "niagaai_invoices";
const invoiceStatuses = new Set<InvoiceStatus>(["draft", "sent", "partially_paid", "paid", "void"]);
const LEGACY_BUSINESS_ID = "business_demo";

function parseInvoiceItem(value: unknown): InvoiceLineItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (!(typeof item.id === "string" && typeof item.description === "string" &&
    typeof item.quantity === "number" && Number.isFinite(item.quantity) &&
    typeof item.unitPrice === "number" && Number.isFinite(item.unitPrice) &&
    typeof item.taxRate === "number" && Number.isFinite(item.taxRate))) return null;
  return { id: item.id, description: item.description, quantity: item.quantity, unitPrice: item.unitPrice, taxRate: item.taxRate };
}

function migrateInvoice(value: unknown): Invoice | null {
  if (!value || typeof value !== "object") return null;
  const invoice = value as Record<string, unknown>;
  if (!Array.isArray(invoice.items) || invoice.items.length === 0) return null;
  const items = invoice.items.map(parseInvoiceItem);
  if (items.some((item) => item === null)) return null;
  const legacyStatus = String(invoice.status);
  const status = (legacyStatus === "overdue" ? "sent" : legacyStatus) as InvoiceStatus;
  if (!(typeof invoice.id === "string" && typeof invoice.invoiceNumber === "string" &&
    typeof invoice.customerName === "string" && typeof invoice.issueDate === "string" &&
    typeof invoice.dueDate === "string" && invoiceStatuses.has(status) &&
    typeof invoice.subtotal === "number" && Number.isFinite(invoice.subtotal) &&
    typeof invoice.tax === "number" && Number.isFinite(invoice.tax) &&
    typeof invoice.total === "number" && Number.isFinite(invoice.total) &&
    typeof invoice.createdAt === "string" && typeof invoice.updatedAt === "string")) return null;
  return {
    id: invoice.id,
    businessId: typeof invoice.businessId === "string" ? invoice.businessId : LEGACY_BUSINESS_ID,
    customerId: typeof invoice.customerId === "string" ? invoice.customerId : null,
    invoiceNumber: invoice.invoiceNumber,
    customerName: invoice.customerName,
    customerEmail: typeof invoice.customerEmail === "string" ? invoice.customerEmail : null,
    buyerTin: typeof invoice.buyerTin === "string" ? invoice.buyerTin : null,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    status,
    currency: "MYR",
    items: items.filter((item): item is InvoiceLineItem => item !== null),
    subtotal: invoice.subtotal,
    tax: invoice.tax,
    total: invoice.total,
    amountPaid: typeof invoice.amountPaid === "number" ? invoice.amountPaid : status === "paid" ? invoice.total : 0,
    notes: typeof invoice.notes === "string" ? invoice.notes : null,
    paymentTerms: typeof invoice.paymentTerms === "string" ? invoice.paymentTerms : null,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  };
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
    return parsed.reduce<Invoice[]>((invoices, value) => {
      const invoice = migrateInvoice(value);
      if (!invoice || seen.has(invoice.id)) return invoices;
      seen.add(invoice.id);
      invoices.push(invoice);
      return invoices;
    }, []);
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
