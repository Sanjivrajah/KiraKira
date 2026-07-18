import { describe, expect, it } from "vitest";
import { assessEInvoiceReadiness, formatEInvoiceHint } from "@/features/transaction-agent/einvoice-hint";
import type { TransactionExtraction } from "@/features/transaction-agent/transaction.schema";

const sale = (overrides: Partial<TransactionExtraction> = {}): TransactionExtraction => ({
  type: "income", amount: 250, currency: "MYR", description: "Catering order", merchantOrCustomer: "Ravi",
  paymentMethod: "bank_transfer", transactionDate: "2026-07-18", category: "Sales revenue", quantity: null, unit: null,
  missingFields: [], confidence: 0.9, ...overrides,
});

describe("e-invoice readiness hint", () => {
  it("does not apply to expenses", () => {
    expect(assessEInvoiceReadiness(sale({ type: "expense" })).applicable).toBe(false);
    expect(formatEInvoiceHint(sale({ type: "expense" }))).toBeNull();
  });

  it("lists captured essentials and the MyInvois fields still required for a sale", () => {
    const hint = assessEInvoiceReadiness(sale());
    expect(hint.applicable).toBe(true);
    expect(hint.have).toEqual(["amount", "date", "description", "customer"]);
    // Buyer TIN (g10) and line classification (g28) are never captured from a plain sale.
    expect(hint.needs).toEqual([
      { label: "Buyer's TIN", guideline: 10 },
      { label: "Classification", guideline: 28 },
    ]);
  });

  it("flags a missing buyer name as an additional required field", () => {
    const hint = assessEInvoiceReadiness(sale({ merchantOrCustomer: null }));
    expect(hint.have).not.toContain("customer");
    expect(hint.needs[0]).toEqual({ label: "Buyer's name" });
  });

  it("renders a guidance-only line that references the guideline numbers", () => {
    const line = formatEInvoiceHint(sale());
    expect(line).toContain("MyInvois e-Invoice");
    expect(line).toContain("Buyer's TIN (g10)");
    expect(line).toContain("Classification (g28)");
    expect(line).toMatch(/not a submission/i);
  });

  it("localises the hint to Bahasa Melayu", () => {
    expect(formatEInvoiceHint(sale(), "ms")).toMatch(/e-Invois/);
  });
});
