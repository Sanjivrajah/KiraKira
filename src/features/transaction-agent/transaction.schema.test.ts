import { describe, expect, it } from "vitest";
import { transactionExtractionSchema } from "@/features/transaction-agent/transaction.schema";

const validDraft = {
  type: "income", amount: 50, currency: "MYR", description: "Sold nasi lemak", merchantOrCustomer: null,
  paymentMethod: "cash", transactionDate: "2026-07-15", category: null, quantity: 10, unit: "packets", missingFields: [], confidence: 0.9,
};

describe("transactionExtractionSchema", () => {
  it("accepts a validated MYR transaction draft", () => {
    expect(transactionExtractionSchema.parse(validDraft).amount).toBe(50);
  });

  it("rejects invalid confidence and dates", () => {
    expect(() => transactionExtractionSchema.parse({ ...validDraft, confidence: 2 })).toThrow();
    expect(() => transactionExtractionSchema.parse({ ...validDraft, transactionDate: "15-07-2026" })).toThrow();
  });
});
