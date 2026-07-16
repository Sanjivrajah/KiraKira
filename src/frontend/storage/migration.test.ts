import { describe, expect, it } from "vitest";
import { BrowserStorage } from "@/lib/storage/browser-storage";
import { STORAGE_KEYS } from "@/lib/storage/storage-keys";
import { clearFrontendDomainStorage, FRONTEND_DATA_VERSION, FRONTEND_STORAGE_KEYS, runFrontendStorageMigration } from "./migration";

function memoryStorage() {
  const values = new Map<string, string>();
  const storage: Storage = {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
  return new BrowserStorage(() => storage);
}

const business = {
  id: "business_legacy", name: "Legacy Kedai", type: "retail", registrationNumber: "20260101", tin: "C1234567890",
  currency: "MYR", preferredLanguage: "en", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};
const invoice = {
  id: "invoice_legacy", businessId: business.id, invoiceNumber: "INV-OLD-1", customerName: "Old Customer",
  issueDate: "2026-01-02", dueDate: "2026-01-16", status: "draft", subtotal: 100, tax: 6, total: 106,
  items: [{ id: "line_1", description: "Legacy service", quantity: 1, unitPrice: 100, taxRate: 6 }],
  createdAt: "2026-01-02T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z",
};
const transaction = {
  id: "transaction_legacy", businessId: business.id, createdBy: "user_legacy", type: "income", status: "confirmed",
  sourceType: "manual", date: "2026-01-03", category: "Sales", description: "Legacy sale", counterpartyName: "Old Customer",
  total: 50, createdAt: "2026-01-03T00:00:00.000Z", updatedAt: "2026-01-03T00:00:00.000Z",
};

describe("frontend domain storage migration", () => {
  it("migrates legacy records without removing their original keys", () => {
    const storage = memoryStorage();
    storage.set(STORAGE_KEYS.businesses, [business]);
    storage.set(STORAGE_KEYS.invoices, [invoice]);
    storage.set(STORAGE_KEYS.transactions, [transaction]);
    const report = runFrontendStorageMigration(storage);
    expect(report).toMatchObject({
      status: "migrated",
      migrated: { businesses: 1, parties: 1, transactions: 1, documents: 1 },
      skipped: 0,
    });
    expect(storage.get(FRONTEND_STORAGE_KEYS.documents, [])).toEqual([
      expect.objectContaining({ id: invoice.id, internalDocumentNumber: invoice.invoiceNumber }),
    ]);
    expect(storage.get(FRONTEND_STORAGE_KEYS.transactions, [])).toEqual([
      expect.objectContaining({ id: transaction.id, lifecycle: "confirmed", eInvoiceTreatment: "undetermined" }),
    ]);
    expect(storage.get(STORAGE_KEYS.invoices, [])).toEqual([invoice]);
  });

  it("is idempotent after the current version is recorded", () => {
    const storage = memoryStorage();
    storage.set(STORAGE_KEYS.businesses, [business]);
    expect(runFrontendStorageMigration(storage).status).toBe("migrated");
    expect(runFrontendStorageMigration(storage)).toMatchObject({ status: "current", fromVersion: FRONTEND_DATA_VERSION });
  });

  it("skips malformed records safely and supports a complete domain reset", () => {
    const storage = memoryStorage();
    storage.set(STORAGE_KEYS.invoices, [{ id: "broken", items: [] }]);
    const report = runFrontendStorageMigration(storage);
    expect(report.status).toBe("migrated");
    expect(report.skipped).toBe(1);
    expect(report.errors.length).toBeGreaterThan(0);
    clearFrontendDomainStorage(storage);
    expect(storage.has(FRONTEND_STORAGE_KEYS.version)).toBe(false);
    expect(storage.get(STORAGE_KEYS.invoices, [])).toEqual([{ id: "broken", items: [] }]);
  });
});

