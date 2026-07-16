import { describe, expect, it } from "vitest";
import { multiIntentExtractionSchema } from "./multi-intent.schema";

const transaction = { type: "income", amount: 100, currency: "MYR", description: "Sale of nasi lemak", merchantOrCustomer: null, paymentMethod: "cash", transactionDate: "2026-07-16", category: "Sales revenue", quantity: 20, unit: "items", missingFields: [], confidence: 0.9 };

describe("multi intent extraction schema", () => {
  it("allows a sale and expense while retaining an unsupported receivable proposal", () => {
    expect(multiIntentExtractionSchema.parse({ actions: [
      { actionIndex: 1, capability: "transaction_capture", transaction, evidenceSummary: "Sold 20 nasi lemak at RM5", missingFields: [] },
      { actionIndex: 2, capability: "transaction_capture", transaction: { ...transaction, type: "expense", amount: 30, description: "Purchase of ingredients", category: "Raw materials", quantity: null, unit: null }, evidenceSummary: "Bought ingredients RM30", missingFields: [] },
      { actionIndex: 3, capability: "receivable_capture", evidenceSummary: "Ali has not paid RM15", uncertainty: "unsupported", missingFields: [] },
    ], globalAmbiguityNotes: [] })).toMatchObject({ actions: [{ actionIndex: 1 }, { actionIndex: 2 }, { capability: "receivable_capture" }] });
  });

  it("rejects duplicate action identifiers and transaction-less executable actions", () => {
    const result = multiIntentExtractionSchema.safeParse({ actions: [
      { actionIndex: 1, capability: "transaction_capture", evidenceSummary: "Sale", missingFields: [] },
      { actionIndex: 1, capability: "unsupported", evidenceSummary: "Invoice", uncertainty: "unsupported", missingFields: [] },
    ], globalAmbiguityNotes: [] });
    expect(result.success).toBe(false);
  });
});
