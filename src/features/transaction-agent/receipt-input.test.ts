import { describe, expect, it } from "vitest";
import { receiptExtractionSchema, type ReceiptExtraction } from "@/lib/openai/receipt-schema";
import { hasMultipleReceiptTransactions, receiptToTransactionExtraction } from "./receipt-input";

const stringField = (value: string | null) => ({ value, evidenceText: value, confidence: value === null ? 0 : 0.9 });
const numberField = (value: number | null) => ({ value, evidenceText: value === null ? null : String(value), confidence: value === null ? 0 : 0.9 });
const receipt = (overrides: Partial<ReceiptExtraction> = {}) => receiptExtractionSchema.parse({
  documentType: "receipt",
  merchantName: stringField("Kedai Ali"),
  invoiceNumber: stringField("INV-1"),
  documentDate: stringField("2026-07-16"),
  currency: stringField("MYR"),
  lineItems: [{ description: "Shop supplies", quantity: 2, unitPrice: 10, amount: 20, evidenceText: "2 x supplies", confidence: 0.9 }],
  subtotal: numberField(20),
  tax: numberField(0),
  total: numberField(20),
  paymentMethod: stringField("DuitNow transfer"),
  category: stringField("Supplies"),
  missingFields: [],
  warnings: [],
  overallConfidence: 0.9,
  ...overrides,
});

describe("receiptToTransactionExtraction", () => {
  it("maps visible receipt fields into an unconfirmed transaction candidate", () => {
    expect(receiptToTransactionExtraction(receipt())).toEqual(expect.objectContaining({
      type: "unknown",
      amount: 20,
      currency: "MYR",
      description: "Shop supplies",
      merchantOrCustomer: "Kedai Ali",
      paymentMethod: "bank_transfer",
      transactionDate: "2026-07-16",
      category: "Supplies",
      quantity: 2,
      missingFields: ["type"],
    }));
  });

  it("asks for fields the receipt does not prove instead of inventing them", () => {
    const extraction = receiptToTransactionExtraction(receipt({
      documentDate: stringField(null),
      lineItems: [],
      total: numberField(null),
      paymentMethod: stringField(null),
    }));
    expect(extraction).toMatchObject({ type: "unknown", amount: null, description: "", paymentMethod: "unknown", transactionDate: null });
    expect(extraction.missingFields).toEqual(["type", "amount", "purpose", "transactionDate", "paymentMethod"]);
  });

  it("detects the extractor's bounded multi-receipt warning", () => {
    expect(hasMultipleReceiptTransactions(receipt({ warnings: ["Multiple receipts or separately totaled transactions were detected."] }))).toBe(true);
    expect(hasMultipleReceiptTransactions(receipt())).toBe(false);
  });
});
