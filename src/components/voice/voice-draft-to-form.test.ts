import { describe, expect, it } from "vitest";
import { voiceInvoiceToPrefill, voiceTransactionToDraft } from "./voice-draft-to-form";
import type { VoiceInvoiceDraft, VoiceTransactionDraft } from "./voice-draft-store";

const invoiceDraft = (overrides: Partial<VoiceInvoiceDraft> = {}): VoiceInvoiceDraft => ({
  customerId: "cust_1",
  customerName: "Kedai Ali",
  customerEmail: null,
  buyerTin: null,
  issueDate: "2026-07-18",
  dueDate: "2026-08-01",
  paymentTerms: "Net 14",
  prepaymentAmount: 0,
  notes: "Thanks",
  items: [
    {
      description: "Consulting",
      quantity: 2,
      unitPrice: 100,
      taxRate: 6,
      classificationCode: "",
      unitCode: "",
      taxTypeCode: "",
      exemptionReason: "",
      discountAmount: 0,
      chargeAmount: 0,
    },
  ],
  ...overrides,
});

const transactionDraft = (overrides: Partial<VoiceTransactionDraft> = {}): VoiceTransactionDraft => ({
  mode: "create",
  editingId: null,
  type: "expense",
  date: "2026-07-18",
  amount: 42.5,
  taxRate: 0,
  taxInclusive: false,
  quantity: null,
  unit: "",
  category: "Fuel",
  description: "Petrol",
  counterpartyId: null,
  counterpartyName: "Petronas",
  paymentMethod: "cash",
  notes: "",
  original: null,
  ...overrides,
});

describe("voiceInvoiceToPrefill", () => {
  it("carries over header fields and line values", () => {
    const prefill = voiceInvoiceToPrefill(invoiceDraft());
    expect(prefill.customerId).toBe("cust_1");
    expect(prefill.issueDate).toBe("2026-07-18");
    expect(prefill.dueDate).toBe("2026-08-01");
    expect(prefill.paymentTerms).toBe("Net 14");
    expect(prefill.items[0]).toMatchObject({ description: "Consulting", quantity: 2, unitPrice: 100, taxRate: 6 });
  });

  it("fills MyInvois line defaults when codes are blank", () => {
    const prefill = voiceInvoiceToPrefill(invoiceDraft());
    expect(prefill.items[0].classificationCode).toBe("022");
    expect(prefill.items[0].unitCode).toBe("C62");
    expect(prefill.items[0].taxTypeCode).toBe("06");
  });

  it("keeps explicit codes when provided", () => {
    const prefill = voiceInvoiceToPrefill(
      invoiceDraft({ items: [{ ...invoiceDraft().items[0], classificationCode: "004", unitCode: "KGM", taxTypeCode: "E" }] }),
    );
    expect(prefill.items[0]).toMatchObject({ classificationCode: "004", unitCode: "KGM", taxTypeCode: "E" });
  });

  it("gives each line a stable deterministic id", () => {
    const prefill = voiceInvoiceToPrefill(
      invoiceDraft({ items: [invoiceDraft().items[0], invoiceDraft().items[0]] }),
    );
    expect(prefill.items.map((item) => item.id)).toEqual(["voice-item-0", "voice-item-1"]);
  });
});

describe("voiceTransactionToDraft", () => {
  it("maps a staged transaction into the review form draft", () => {
    const draft = voiceTransactionToDraft(transactionDraft());
    expect(draft).toMatchObject({
      type: "expense",
      date: "2026-07-18",
      amount: 42.5,
      category: "Fuel",
      description: "Petrol",
      counterpartyName: "Petronas",
      paymentMethod: "cash",
      source: "voice",
    });
  });

  it("converts a null amount to undefined", () => {
    expect(voiceTransactionToDraft(transactionDraft({ amount: null })).amount).toBeUndefined();
  });
});
