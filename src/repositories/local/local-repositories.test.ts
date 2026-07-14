import { beforeEach, describe, expect, it } from "vitest";
import { BrowserStorage } from "@/lib/storage/browser-storage";
import { STORAGE_KEYS } from "@/lib/storage/storage-keys";
import { mockInvoices } from "@/data/mock-invoices";
import { mockTransactions } from "@/data/mock-transactions";
import type { Payment, Reminder } from "@/types";
import { LocalInvoiceRepository, LocalPaymentRepository, LocalReminderRepository, LocalTransactionRepository } from "@/repositories";

describe("local repositories", () => {
  const storage = new BrowserStorage();
  const transactions = new LocalTransactionRepository(storage);
  const invoices = new LocalInvoiceRepository(storage);
  const payments = new LocalPaymentRepository(storage);
  const reminders = new LocalReminderRepository(storage);

  beforeEach(() => localStorage.clear());

  it("returns empty lists and initializes demo fixtures deterministically", async () => {
    expect(await transactions.list({ businessId: "business_demo" })).toEqual([]);
    expect(await transactions.initializeDemo({ businessId: "business_demo", fixtures: mockTransactions })).toMatchObject(mockTransactions);
    localStorage.setItem(STORAGE_KEYS.transactions, "[]");
    expect(await transactions.initializeDemo({ businessId: "business_demo", fixtures: mockTransactions })).toEqual([]);
  });

  it("creates, reads, updates, deletes, and isolates transactions by business", async () => {
    const first = { ...mockTransactions[0], id: "txn_new" };
    const second = { ...mockTransactions[0], id: "txn_other", businessId: "business_other" };
    await transactions.create({ transaction: first });
    await transactions.create({ transaction: second });
    expect(await transactions.list({ businessId: "business_demo" })).toMatchObject([first]);
    expect((await transactions.getById({ businessId: "business_demo", transactionId: first.id }))?.total).toBe(480);
    expect((await transactions.update({ businessId: "business_demo", transactionId: first.id, changes: { total: 500 } })).total).toBe(500);
    await transactions.remove({ businessId: "business_demo", transactionId: first.id });
    expect(await transactions.list({ businessId: "business_demo" })).toEqual([]);
    expect(await transactions.list({ businessId: "business_other" })).toHaveLength(1);
  });

  it("handles malformed JSON and invalid records without leaking errors", async () => {
    localStorage.setItem(STORAGE_KEYS.transactions, "not-json");
    expect(await transactions.list({ businessId: "business_demo" })).toEqual([]);
    localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify([{ id: "bad" }, mockTransactions[0]]));
    expect(await transactions.list({ businessId: "business_demo" })).toMatchObject([mockTransactions[0]]);
  });

  it("maps storage write failures to the application error model", () => {
    const unavailable = new BrowserStorage(() => undefined);
    expect(() => unavailable.set("test", { value: true })).toThrowError(expect.objectContaining({ code: "WRITE_FAILED" }));
  });

  it("persists invoice status and resets invoice data", async () => {
    await invoices.initializeDemo({ businessId: "business_demo", fixtures: mockInvoices });
    const updated = await invoices.update({ businessId: "business_demo", invoiceId: "inv_1022", changes: { status: "sent" } });
    expect(updated.status).toBe("sent");
    expect((await invoices.getById({ businessId: "business_demo", invoiceId: "inv_1022" }))?.status).toBe("sent");
    await invoices.clear();
    expect(await invoices.list({ businessId: "business_demo" })).toEqual([]);
  });

  it("persists reminder history and removes it by invoice", async () => {
    const reminder: Reminder = { id: "rem_1", businessId: "business_demo", invoiceId: "inv_1024", recipient: "demo@example.com", channel: "manual", status: "sent", sentAt: "2026-07-14T00:00:00.000Z", createdAt: "2026-07-14T00:00:00.000Z", updatedAt: "2026-07-14T00:00:00.000Z" };
    await reminders.create({ reminder });
    expect(await reminders.list({ businessId: "business_demo", invoiceId: "inv_1024" })).toMatchObject([reminder]);
    await reminders.removeForInvoice({ businessId: "business_demo", invoiceId: "inv_1024" });
    expect(await reminders.list({ businessId: "business_demo" })).toEqual([]);
  });

  it("provides payment persistence for the future backend boundary", async () => {
    const payment: Payment = { id: "pay_1", businessId: "business_demo", invoiceId: "inv_1024", amount: 100, currency: "MYR", paidAt: "2026-07-14T00:00:00.000Z", status: "completed", createdAt: "2026-07-14T00:00:00.000Z", updatedAt: "2026-07-14T00:00:00.000Z" };
    await payments.create({ payment });
    expect(await payments.list({ businessId: "business_demo", invoiceId: "inv_1024" })).toMatchObject([payment]);
    await payments.clearForBusiness({ businessId: "business_demo" });
    expect(await payments.list({ businessId: "business_demo" })).toEqual([]);
  });
});
