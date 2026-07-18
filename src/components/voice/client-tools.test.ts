import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Invoice, Transaction } from "@/types";
import { createVoiceClientTools, type VoiceClientToolDeps, type VoiceDraftController } from "./client-tools";
import type {
  VoiceConfirmation,
  VoiceCustomerDraft,
  VoiceInvoiceDraft,
  VoicePendingDelete,
  VoicePendingPayment,
  VoiceReminderDraft,
  VoiceTransactionDraft,
} from "./voice-draft-store";

function makeDraftController() {
  const state: {
    transaction: VoiceTransactionDraft | null;
    invoice: VoiceInvoiceDraft | null;
    reminder: VoiceReminderDraft | null;
    pendingDelete: VoicePendingDelete | null;
    pendingPayment: VoicePendingPayment | null;
    customer: VoiceCustomerDraft | null;
    lastConfirmation: VoiceConfirmation | null;
  } = { transaction: null, invoice: null, reminder: null, pendingDelete: null, pendingPayment: null, customer: null, lastConfirmation: null };
  const controller: VoiceDraftController = {
    setTransaction: (draft) => { state.transaction = draft; },
    patchTransaction: (patch) => { if (state.transaction) state.transaction = { ...state.transaction, ...patch }; },
    getTransaction: () => state.transaction,
    clearTransaction: () => { state.transaction = null; },
    setInvoice: (draft) => { state.invoice = draft; },
    patchInvoice: (patch) => { if (state.invoice) state.invoice = { ...state.invoice, ...patch }; },
    getInvoice: () => state.invoice,
    clearInvoice: () => { state.invoice = null; },
    setReminder: (draft) => { state.reminder = draft; },
    getReminder: () => state.reminder,
    setPendingDelete: (draft) => { state.pendingDelete = draft; },
    getPendingDelete: () => state.pendingDelete,
    setPendingPayment: (draft) => { state.pendingPayment = draft; },
    getPendingPayment: () => state.pendingPayment,
    setCustomer: (draft) => { state.customer = draft; },
    getCustomer: () => state.customer,
    setLastConfirmation: (confirmation) => { state.lastConfirmation = confirmation; },
  };
  return { state, controller };
}

const confirmedTxn = (overrides: Partial<Transaction>): Transaction => ({
  id: crypto.randomUUID(), businessId: "biz", createdBy: "user", type: "income", status: "confirmed",
  sourceType: "voice", date: "2026-07-15", counterpartyName: "", description: "d", category: "Sales",
  currency: "MYR", subtotal: 100, tax: 0, total: 100, items: [],
  createdAt: "2026-07-15T00:00:00.000Z", updatedAt: "2026-07-15T00:00:00.000Z", ...overrides,
});

const demoInvoice = (overrides: Partial<Invoice>): Invoice => ({
  id: crypto.randomUUID(), businessId: "biz", customerId: null, invoiceNumber: "INV-1024", customerName: "Customer",
  customerEmail: null, buyerTin: null, issueDate: "2026-07-01", dueDate: "2026-07-15", status: "sent", currency: "MYR",
  items: [], subtotal: 100, tax: 0, total: 100, amountPaid: 0,
  createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z", ...overrides,
});

function buildDeps(overrides: Partial<VoiceClientToolDeps> = {}) {
  const { state, controller } = makeDraftController();
  const createTransaction = vi.fn(async (input: Omit<Transaction, "id" | "createdAt" | "updatedAt">) =>
    ({ ...input, id: "txn_1", createdAt: "x", updatedAt: "x" } as Transaction));
  const createInvoice = vi.fn(async (input: Omit<Invoice, "id" | "createdAt" | "updatedAt" | "subtotal" | "tax" | "total">) =>
    ({ ...input, id: "inv_1", subtotal: 100, tax: 0, total: 100, createdAt: "x", updatedAt: "x" } as Invoice));
  const navigate = vi.fn();
  const deps: VoiceClientToolDeps = {
    businessId: "biz",
    createdBy: "user",
    draft: controller,
    listTransactions: async () => [],
    createTransaction,
    listInvoices: async () => [],
    nextInvoiceNumber: async () => "INV-1024",
    createInvoice,
    navigate,
    getContext: () => ({ pathname: "/voice", businessName: "Kedai Ali" }),
    now: () => new Date("2026-07-17T02:00:00Z"),
    ...overrides,
  };
  return { deps, state, createTransaction, createInvoice, navigate, tools: createVoiceClientTools(deps) };
}

describe("createVoiceClientTools", () => {
  let harness: ReturnType<typeof buildDeps>;
  beforeEach(() => { harness = buildDeps(); });

  it("stages a transaction draft without persisting and defaults the date to KL today", () => {
    const message = harness.tools.create_transaction_draft({ type: "expense", amount: 45, description: "Petrol", category: "Fuel", paymentMethod: "cash" });
    expect(message).toContain("staged");
    expect(harness.state.transaction).toMatchObject({ type: "expense", amount: 45, date: "2026-07-17", category: "Fuel" });
    expect(harness.createTransaction).not.toHaveBeenCalled();
  });

  it("asks for the amount when it is missing", () => {
    const message = harness.tools.create_transaction_draft({ type: "expense", description: "Petrol", category: "Fuel" });
    expect(message).toContain("amount");
    expect(harness.state.transaction?.amount).toBeNull();
  });

  it("confirms a staged transaction with voice provenance and clears the draft", async () => {
    harness.tools.create_transaction_draft({ type: "expense", amount: 45.5, description: "Petrol", category: "Fuel" });
    const message = await harness.tools.confirm_transaction({});
    expect(harness.createTransaction).toHaveBeenCalledTimes(1);
    expect(harness.createTransaction.mock.calls[0][0]).toMatchObject({
      sourceType: "voice", status: "confirmed", total: 45.5, subtotal: 45.5, tax: 0, currency: "MYR",
    });
    expect(harness.state.transaction).toBeNull();
    expect(message).toContain("Saved");
  });

  it("refuses to confirm without an amount", async () => {
    harness.tools.create_transaction_draft({ type: "expense", description: "Petrol", category: "Fuel" });
    const message = await harness.tools.confirm_transaction({});
    expect(harness.createTransaction).not.toHaveBeenCalled();
    expect(message).toContain("amount");
  });

  it("summarizes finances over confirmed transactions", async () => {
    const deps = { listTransactions: async () => [confirmedTxn({ type: "income", total: 300, date: "2026-07-10" }), confirmedTxn({ type: "expense", total: 100, date: "2026-07-11" })] };
    const { tools } = buildDeps(deps);
    const message = await tools.query_finances({ period: "this_month" });
    expect(message).toContain("money in");
    expect(message).toContain("300.00");
    expect(message).toContain("100.00");
    expect(message).toContain("200.00");
  });

  it("maps navigation destinations to routes", () => {
    const message = harness.tools.navigate({ destination: "invoices" });
    expect(harness.navigate).toHaveBeenCalledWith("/invoices");
    expect(message).toContain("Opening");
  });

  it("persists a staged invoice as a draft with e-invoice line codes", async () => {
    await harness.tools.create_invoice_draft({ customerName: "Mei Enterprise", items: [{ description: "Design work", quantity: 2, unitPrice: 150, taxRate: 0 }] });
    expect(harness.state.invoice).toMatchObject({ customerName: "Mei Enterprise" });
    const message = await harness.tools.confirm_invoice({});
    expect(harness.createInvoice).toHaveBeenCalledTimes(1);
    const created = harness.createInvoice.mock.calls[0][0];
    expect(created).toMatchObject({ status: "draft", invoiceNumber: "INV-1024", customerName: "Mei Enterprise" });
    expect(created.items[0]).toMatchObject({ classificationCode: "022", unitCode: "C62", taxTypeCode: "06" });
    expect(harness.state.invoice).toBeNull();
    expect(message).toContain("INV-1024");
  });

  it("accepts invoice items as a JSON string (the ElevenLabs shape)", async () => {
    const message = await harness.tools.create_invoice_draft({
      customerName: "Ali Trading",
      items: '[{"description":"Kraf bag","quantity":3,"unitPrice":30}]',
    });
    expect(message).toContain("staged");
    expect(harness.state.invoice?.items[0]).toMatchObject({ description: "Kraf bag", quantity: 3, unitPrice: 30, taxRate: 0, classificationCode: "022", unitCode: "C62", taxTypeCode: "06" });
  });

  it("splits a tax-inclusive amount and persists notes on confirm", async () => {
    harness.tools.create_transaction_draft({ type: "expense", amount: 106, taxRate: 6, taxInclusive: true, description: "Packaging", category: "Supplies", notes: "For Raya orders" });
    expect(harness.state.transaction).toMatchObject({ taxRate: 6, taxInclusive: true, notes: "For Raya orders" });
    await harness.tools.confirm_transaction({});
    expect(harness.createTransaction.mock.calls[0][0]).toMatchObject({ subtotal: 100, tax: 6, total: 106, notes: "For Raya orders", sourceType: "voice" });
  });

  it("normalizes a spoken payment method to the stored enum", () => {
    harness.tools.create_transaction_draft({ type: "expense", amount: 20, description: "Lunch", category: "Food", paymentMethod: "Touch n Go" });
    expect(harness.state.transaction?.paymentMethod).toBe("ewallet");
  });

  it("links a known customer's TIN and email when drafting an invoice", async () => {
    const listCustomers = vi.fn(async () => [{ id: "party_1", name: "Mei Enterprise", email: "mei@demo.test", tin: "EI00000000099" }]);
    const { tools, state } = buildDeps({ listCustomers });
    await tools.create_invoice_draft({ customerName: "Mei", items: [{ description: "Bag", quantity: 3, unitPrice: 30, taxRate: 6 }] });
    expect(state.invoice).toMatchObject({ customerId: "party_1", buyerTin: "EI00000000099", customerEmail: "mei@demo.test" });
  });

  it("adds and removes invoice line items, guarding the last one", async () => {
    await harness.tools.create_invoice_draft({ customerName: "Ali", items: [{ description: "Bag", quantity: 1, unitPrice: 30 }] });
    const added = harness.tools.add_invoice_line_item({ description: "Tote", quantity: 2, unitPrice: 20 });
    expect(harness.state.invoice?.items).toHaveLength(2);
    expect(added).toContain("2 line items");
    const removed = harness.tools.remove_invoice_line_item({ description: "Tote" });
    expect(harness.state.invoice?.items).toHaveLength(1);
    expect(removed).toContain("Removed Tote");
    const guarded = harness.tools.remove_invoice_line_item({ description: "Bag" });
    expect(guarded).toContain("at least one line item");
    expect(harness.state.invoice?.items).toHaveLength(1);
  });

  it("edits a saved transaction through update, preserving id and createdAt", async () => {
    const record = confirmedTxn({ id: "txn_petrol", type: "expense", total: 45, subtotal: 45, tax: 0, description: "Petrol", date: "2026-07-16", createdAt: "2026-07-16T00:00:00.000Z" });
    const updateTransaction = vi.fn(async (transaction: Transaction) => transaction);
    const { tools, state } = buildDeps({ listTransactions: async () => [record], updateTransaction });
    await tools.edit_transaction({ transactionId: "txn_petrol" });
    expect(state.transaction).toMatchObject({ mode: "edit", editingId: "txn_petrol", amount: 45 });
    tools.update_transaction_draft({ amount: 50 });
    await tools.confirm_transaction({});
    expect(updateTransaction).toHaveBeenCalledTimes(1);
    expect(updateTransaction.mock.calls[0][0]).toMatchObject({ id: "txn_petrol", total: 50, createdAt: "2026-07-16T00:00:00.000Z" });
  });

  it("finds saved transactions by amount and description", async () => {
    const records = [
      confirmedTxn({ id: "txn_a", type: "expense", total: 45, description: "Petrol", date: "2026-07-16" }),
      confirmedTxn({ id: "txn_b", type: "income", total: 300, description: "Sales", date: "2026-07-15" }),
    ];
    const { tools } = buildDeps({ listTransactions: async () => records });
    const message = await tools.find_transactions({ query: "petrol" });
    expect(message).toContain("txn_a");
    expect(message).not.toContain("txn_b");
  });

  it("stages a delete and only removes on confirmation", async () => {
    const record = confirmedTxn({ id: "txn_del", type: "expense", total: 45, description: "Petrol" });
    const removeTransaction = vi.fn(async () => undefined);
    const { tools, state } = buildDeps({ listTransactions: async () => [record], removeTransaction });
    await tools.delete_transaction({ transactionId: "txn_del" });
    expect(state.pendingDelete).toMatchObject({ id: "txn_del" });
    expect(removeTransaction).not.toHaveBeenCalled();
    const message = await tools.confirm_delete({});
    expect(removeTransaction).toHaveBeenCalledWith("txn_del");
    expect(state.pendingDelete).toBeNull();
    expect(message).toContain("Deleted");
  });

  it("stages then records an invoice payment, updating status", async () => {
    const invoice = demoInvoice({ id: "inv_1", invoiceNumber: "INV-1024", customerName: "Kedai Murni", status: "sent", total: 200, amountPaid: 0, dueDate: "2026-07-01" });
    const updateInvoice = vi.fn(async (value: Invoice) => value);
    const { tools, state } = buildDeps({ listInvoices: async () => [invoice], updateInvoice });
    await tools.record_invoice_payment({ customerName: "Kedai Murni", amount: 200 });
    expect(state.pendingPayment).toMatchObject({ invoiceId: "inv_1", amount: 200 });
    await tools.confirm_invoice_payment({});
    expect(updateInvoice.mock.calls[0][0]).toMatchObject({ id: "inv_1", amountPaid: 200, status: "paid" });
  });

  it("rejects an overpayment when recording a payment", async () => {
    const invoice = demoInvoice({ id: "inv_2", invoiceNumber: "INV-1025", customerName: "Teras Digital", status: "sent", total: 100, amountPaid: 0, dueDate: "2026-07-01" });
    const { tools, state } = buildDeps({ listInvoices: async () => [invoice] });
    const message = await tools.record_invoice_payment({ customerName: "Teras", amount: 250 });
    expect(message).toContain("more than");
    expect(state.pendingPayment).toBeNull();
  });

  it("marks a reminder as sent against the matched invoice", async () => {
    const invoice = demoInvoice({ id: "inv_3", invoiceNumber: "INV-1026", customerName: "Suria Events", status: "sent", total: 500, amountPaid: 0, dueDate: "2026-07-01" });
    const markReminderSent = vi.fn(async () => undefined);
    const { tools } = buildDeps({ listInvoices: async () => [invoice], markReminderSent });
    await tools.draft_reminder({ customerName: "Suria" });
    await tools.send_reminder({});
    expect(markReminderSent).toHaveBeenCalledTimes(1);
    expect(markReminderSent).toHaveBeenCalledWith(expect.objectContaining({ id: "inv_3" }), expect.any(String));
  });

  it("searches and stages then creates a customer", async () => {
    const listCustomers = vi.fn(async () => [{ id: "party_1", name: "Mei Enterprise", email: null, tin: "EI00000000099" }]);
    const createCustomer = vi.fn(async (input) => ({ id: "party_new", name: input.name, email: input.email ?? null, tin: input.tin ?? null }));
    const { tools, state } = buildDeps({ listCustomers, createCustomer });
    const found = await tools.search_customers({ query: "Mei" });
    expect(found).toContain("Mei Enterprise");
    tools.create_customer({ name: "Baru Trading", tin: "C12345678900" });
    expect(state.customer).toMatchObject({ name: "Baru Trading", tin: "C12345678900" });
    await tools.confirm_customer({});
    expect(createCustomer).toHaveBeenCalledTimes(1);
  });

  it("reports e-invoice readiness gaps from the business context", () => {
    const { tools } = buildDeps({
      getBusinessContext: () => ({ businessName: "Kedai Ali", hasTin: true, hasSstRegistration: false, hasMsicCode: false, hasAddress: true, hasRegistrationNumber: true }),
    });
    const message = tools.get_business_context({});
    expect(message).toContain("SST registration");
    expect(message).toContain("MSIC code");
  });

  it("answers a profit-only finance query", async () => {
    const { tools } = buildDeps({ listTransactions: async () => [confirmedTxn({ type: "income", total: 300, date: "2026-07-10" }), confirmedTxn({ type: "expense", total: 100, date: "2026-07-11" })] });
    const message = await tools.query_finances({ metric: "profit" });
    expect(message).toContain("profit");
    expect(message).toContain("200.00");
  });
});
