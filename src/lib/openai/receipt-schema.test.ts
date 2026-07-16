import { describe, expect, it } from "vitest";
import { receiptExtractionSchema, validateReceiptArithmetic } from "./receipt-schema";

function field<T>(value: T) {
  return { value, evidenceText: value === null ? null : String(value), confidence: 0.95 };
}

function extraction(overrides: Record<string, unknown> = {}) {
  return receiptExtractionSchema.parse({
    documentType: "receipt",
    merchantName: field("Maju Mart"),
    invoiceNumber: field("R-100"),
    documentDate: field("2026-07-14"),
    currency: field("MYR"),
    lineItems: [
      { description: "Rice", quantity: 2, unitPrice: 10, amount: 20, evidenceText: "Rice 2 x 10.00", confidence: 0.95 },
      { description: "Oil", quantity: 1, unitPrice: 5, amount: 5, evidenceText: "Oil 5.00", confidence: 0.95 },
    ],
    subtotal: field(25),
    tax: field(0),
    total: field(25),
    paymentMethod: field("Cash"),
    category: field("Inventory"),
    missingFields: [],
    warnings: [],
    overallConfidence: 0.95,
    ...overrides,
  });
}

describe("validateReceiptArithmetic", () => {
  it("accepts matching line items, subtotal, tax, and total", () => {
    expect(validateReceiptArithmetic(extraction())).toEqual([]);
  });

  it("flags contradictory receipt arithmetic", () => {
    const result = validateReceiptArithmetic(extraction({ subtotal: field(24), total: field(30) }));
    expect(result).toContain("The extracted line items do not add up to the subtotal.");
    expect(result).toContain("The extracted subtotal and tax do not add up to the total.");
  });

  it("does not invent checks when receipt values are missing", () => {
    const result = validateReceiptArithmetic(extraction({ subtotal: field(null), total: field(null) }));
    expect(result).toEqual([]);
  });
});
