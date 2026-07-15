import { describe, expect, it } from "vitest";
import { formatTransactionDraft } from "@/features/transaction-agent/transaction-formatter";

describe("formatTransactionDraft", () => {
  it("formats a complete draft for Telegram", () => {
    expect(formatTransactionDraft({
      type: "expense", amount: 85, currency: "MYR", description: "Purchase of chicken", merchantOrCustomer: "Pasar Borong",
      paymentMethod: "cash", transactionDate: "2026-07-14", category: "Raw materials", quantity: null, unit: null, missingFields: [], confidence: 0.94,
    })).toContain("Amount: RM85.00");
  });

  it("makes incomplete fields visible", () => {
    const message = formatTransactionDraft({
      type: "expense", amount: 300, currency: "MYR", description: "", merchantOrCustomer: "Ali", paymentMethod: "unknown",
      transactionDate: null, category: null, quantity: null, unit: null, missingFields: ["purpose", "transactionDate", "paymentMethod"], confidence: 0.55,
    });
    expect(message).toContain("Date: Unknown");
    expect(message).toContain("Missing information: purpose, transactionDate, paymentMethod");
  });
});
