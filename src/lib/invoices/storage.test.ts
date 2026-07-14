import { beforeEach, describe, expect, it } from "vitest";
import type { Invoice } from "@/types/finance";
import { clearInvoices, deleteInvoice, getInvoices, initializeInvoices, INVOICES_STORAGE_KEY, makeInvoiceNumber, saveInvoice, updateInvoice } from "./storage";

const sample: Invoice = {
  id: "inv_test", invoiceNumber: "INV-1024", customerName: "Kedai Murni", issueDate: "2026-07-01", dueDate: "2026-07-10", status: "sent",
  items: [{ id: "item_test", description: "Catering", quantity: 1, unitPrice: 850, taxRate: 0 }],
  subtotal: 850, tax: 0, total: 850, createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z",
};

describe("invoice storage", () => {
  beforeEach(() => localStorage.clear());

  it("seeds once, then reads, updates, and deletes invoices", () => {
    expect(initializeInvoices([sample])).toEqual([sample]);
    expect(initializeInvoices([])).toEqual([sample]);
    expect(updateInvoice({ ...sample, status: "paid" })).toBe(true);
    expect(getInvoices()[0].status).toBe("paid");
    expect(deleteInvoice(sample.id)).toBe(true);
    expect(getInvoices()).toEqual([]);
  });

  it("ignores malformed records and generates the next invoice number", () => {
    localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify([
      { id: "bad" },
      { ...sample, customerName: "x".repeat(101) },
      { ...sample, items: Array.from({ length: 51 }, (_, index) => ({ ...sample.items[0], id: `item_${index}` })) },
      sample,
    ]));
    expect(getInvoices()).toEqual([sample]);
    expect(makeInvoiceNumber()).toBe("INV-1025");
  });

  it("saves a new invoice and clears storage", () => {
    expect(saveInvoice(sample)).toBe(true);
    expect(getInvoices()).toEqual([sample]);
    expect(clearInvoices()).toBe(true);
    expect(getInvoices()).toEqual([]);
  });
});
