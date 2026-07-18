import { describe, expect, it } from "vitest";
import { buildMultiIntentNotes, splitMultiIntentTransactions } from "@/features/transaction-agent/multi-intent-input";
import type { MultiIntentExtraction } from "@/features/transaction-agent/multi-intent.schema";
import type { TransactionExtraction } from "@/features/transaction-agent/transaction.schema";

const tx = (overrides: Partial<TransactionExtraction>): TransactionExtraction => ({
  type: "income", amount: 25, currency: "MYR", description: "Sale of nasi lemak", merchantOrCustomer: null,
  paymentMethod: "cash", transactionDate: "2026-07-18", category: "Sales revenue", quantity: null, unit: null,
  missingFields: [], confidence: 0.9, ...overrides,
});

const extraction = (actions: MultiIntentExtraction["actions"]): MultiIntentExtraction => ({ actions, globalAmbiguityNotes: [] });

describe("multi-intent input mapping", () => {
  it("returns transaction proposals in detected order and skips non-transaction capabilities", () => {
    const result = splitMultiIntentTransactions(extraction([
      { actionIndex: 2, capability: "transaction_capture", transaction: tx({ description: "Purchase of chicken", type: "expense" }), evidenceSummary: "beli ayam", uncertainty: "none", missingFields: [] },
      { actionIndex: 1, capability: "transaction_capture", transaction: tx({ description: "Sale of nasi lemak" }), evidenceSummary: "sold nasi lemak", uncertainty: "none", missingFields: [] },
      { actionIndex: 3, capability: "receivable_capture", transaction: null, evidenceSummary: "Ahmad owes RM40", uncertainty: "unsupported", missingFields: [] },
    ]));

    expect(result.map((item) => item.description)).toEqual(["Sale of nasi lemak", "Purchase of chicken"]);
  });

  it("summarises skipped receivable and unsupported actions without dropping them silently", () => {
    const notes = buildMultiIntentNotes(extraction([
      { actionIndex: 1, capability: "transaction_capture", transaction: tx({}), evidenceSummary: "sold", uncertainty: "none", missingFields: [] },
      { actionIndex: 2, capability: "receivable_capture", transaction: null, evidenceSummary: "owes", uncertainty: "unsupported", missingFields: [] },
      { actionIndex: 3, capability: "unsupported", transaction: null, evidenceSummary: "invoice please", uncertainty: "unsupported", missingFields: [] },
    ]));

    expect(notes).toHaveLength(2);
    expect(notes[0]).toMatch(/outstanding amount/i);
    expect(notes[1]).toMatch(/outside what I can record/i);
  });

  it("localises notes to Bahasa Melayu", () => {
    const notes = buildMultiIntentNotes(extraction([
      { actionIndex: 1, capability: "receivable_capture", transaction: null, evidenceSummary: "owes", uncertainty: "unsupported", missingFields: [] },
    ]), "ms");

    expect(notes[0]).toMatch(/belum terima/i);
  });
});
