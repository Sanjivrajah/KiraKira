import { beforeEach, describe, expect, it } from "vitest";
import type { Invoice } from "@/types";
import { clearInvoices, deleteInvoice, getInvoices, initializeInvoices, INVOICES_STORAGE_KEY, makeInvoiceNumber, saveInvoice, updateInvoice } from "./storage";

const sample: Invoice = {
  id: "inv_test", businessId: "business_test", customerId: null, invoiceNumber: "INV-1024", customerName: "Kedai Murni", customerEmail: null, buyerTin: null, issueDate: "2026-07-01", dueDate: "2026-07-10", status: "sent", currency: "MYR",
  items: [{ id: "item_test", description: "Catering", quantity: 1, unitPrice: 850, taxRate: 0 }],
  subtotal: 850, tax: 0, total: 850, amountPaid: 0, notes: null, paymentTerms: null, createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z",
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
    localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify([{ id: "bad" }, sample]));
    expect(getInvoices()).toEqual([sample]);
    expect(makeInvoiceNumber()).toBe("INV-1025");
  });

  it("saves a new invoice and clears storage", () => {
    expect(saveInvoice(sample)).toBe(true);
    expect(getInvoices()).toEqual([sample]);
    expect(clearInvoices()).toBe(true);
    expect(getInvoices()).toEqual([]);
  });

  it("migrates legacy overdue invoices to a derived sent state", () => {
    const legacy = { ...sample, businessId: undefined, currency: undefined, amountPaid: undefined, status: "overdue" };
    localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify([legacy]));
    expect(getInvoices()[0]).toMatchObject({
      id: sample.id, businessId: "business_demo", currency: "MYR", amountPaid: 0, status: "sent",
    });
  });
});
