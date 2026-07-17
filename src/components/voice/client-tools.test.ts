import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Invoice, Transaction } from "@/types";
import { createVoiceClientTools, type VoiceClientToolDeps, type VoiceDraftController } from "./client-tools";
import type { VoiceInvoiceDraft, VoiceTransactionDraft } from "./voice-draft-store";

function makeDraftController() {
  const state: {
    transaction: VoiceTransactionDraft | null;
    invoice: VoiceInvoiceDraft | null;
    reminder: unknown;
    lastConfirmation: unknown;
  } = { transaction: null, invoice: null, reminder: null, lastConfirmation: null };
  const controller: VoiceDraftController = {
    setTransaction: (draft) => { state.transaction = draft; },
    patchTransaction: (patch) => { if (state.transaction) state.transaction = { ...state.transaction, ...patch }; },
    getTransaction: () => state.transaction,
    clearTransaction: () => { state.transaction = null; },
    setInvoice: (draft) => { state.invoice = draft; },
    getInvoice: () => state.invoice,
    clearInvoice: () => { state.invoice = null; },
    setReminder: (draft) => { state.reminder = draft; },
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

  it("persists a staged invoice as a draft", async () => {
    harness.tools.create_invoice_draft({ customerName: "Mei Enterprise", items: [{ description: "Design work", quantity: 2, unitPrice: 150, taxRate: 0 }] });
    expect(harness.state.invoice).toMatchObject({ customerName: "Mei Enterprise" });
    const message = await harness.tools.confirm_invoice({});
    expect(harness.createInvoice).toHaveBeenCalledTimes(1);
    expect(harness.createInvoice.mock.calls[0][0]).toMatchObject({ status: "draft", invoiceNumber: "INV-1024", customerName: "Mei Enterprise" });
    expect(harness.state.invoice).toBeNull();
    expect(message).toContain("INV-1024");
  });

  it("accepts invoice items as a JSON string (the ElevenLabs shape)", () => {
    const message = harness.tools.create_invoice_draft({
      customerName: "Ali Trading",
      items: '[{"description":"Kraf bag","quantity":3,"unitPrice":30}]',
    });
    expect(message).toContain("staged");
    expect(harness.state.invoice?.items).toEqual([{ description: "Kraf bag", quantity: 3, unitPrice: 30, taxRate: 0 }]);
  });
});
