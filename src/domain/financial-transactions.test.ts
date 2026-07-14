import { describe, expect, it } from "vitest";
import {
  DEMO_FINANCIAL_TRANSACTIONS,
  DEMO_TRANSACTIONS,
} from "@/data/demo";
import {
  calculateLineSubtotal,
  calculateLineTax,
  calculateLineTotal,
  calculateTransactionTotals,
  currencyCodeSchema,
  decimalStringSchema,
  financialTransactionSchema,
  reconcileTransactionTotals,
  transactionLineSchema,
  type EInvoiceTreatment,
  type MoneyValue,
} from ".";

const TIMESTAMP = "2026-07-14T08:00:00.000Z";

function money(amount: string, currency = "MYR"): MoneyValue {
  return {
    amount: decimalStringSchema.parse(amount),
    currency: currencyCodeSchema.parse(currency),
  };
}

function makeLine({
  id = "line_001",
  quantity = "1",
  unitPrice = "100",
  currency = "MYR",
  discount,
  charges = [],
  taxRate = "0",
  exemption,
}: {
  id?: string;
  quantity?: string;
  unitPrice?: string;
  currency?: string;
  discount?: string;
  charges?: string[];
  taxRate?: string;
  exemption?: { code?: string; reason: string };
} = {}) {
  const price = money(unitPrice, currency);
  const subtotal = calculateLineSubtotal(decimalStringSchema.parse(quantity), price);
  const discountAmount = discount ? money(discount, currency) : undefined;
  const chargeAmounts = charges.map((amount) => money(amount, currency));
  const totalExcludingTax = calculateLineTotal({
    subtotal,
    discount: discountAmount,
    charges: chargeAmounts,
    taxAmount: money("0", currency),
  });
  const taxAmount = calculateLineTax(totalExcludingTax, decimalStringSchema.parse(taxRate));
  const totalIncludingTax = calculateLineTotal({
    subtotal,
    discount: discountAmount,
    charges: chargeAmounts,
    taxAmount,
  });

  return transactionLineSchema.parse({
    id,
    itemReference: "ITEM-001",
    description: "Test item",
    quantity,
    unitCode: "C62",
    unitPrice: price,
    classificationCode: "TEST",
    discount: discountAmount ? { amount: discountAmount, reason: "Promotional discount" } : undefined,
    charges: chargeAmounts.map((amount) => ({ amount, reason: "Delivery" })),
    taxTreatment: {
      taxTypeCode: exemption ? "EXEMPT" : "STANDARD",
      taxRate,
      taxableAmount: totalExcludingTax,
      taxAmount,
      exemption,
    },
    subtotal,
    totalExcludingTax,
    totalIncludingTax,
    countryOfOrigin: "MY",
  });
}

function makeTransaction(overrides: Record<string, unknown> = {}) {
  const line = makeLine();
  return {
    id: "transaction_test_001",
    businessId: "business_demo",
    direction: "income",
    lifecycle: "confirmed",
    transactionDate: "2026-07-14",
    accountingDate: "2026-07-14",
    sourceLinks: [],
    description: "Test transaction",
    categoryCode: "SALES",
    currency: "MYR",
    lines: [line],
    totals: calculateTransactionTotals([line]),
    paymentStatus: "paid",
    eInvoiceTreatment: "undetermined",
    confirmation: { confirmedBy: "user_reviewer", confirmedAt: TIMESTAMP },
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    createdBy: "user_reviewer",
    ...overrides,
  };
}

describe("financial transaction contracts", () => {
  it.each(["income", "expense"] as const)("accepts a confirmed %s transaction", (direction) => {
    const result = financialTransactionSchema.parse(makeTransaction({ direction }));
    expect(result.direction).toBe(direction);
    expect(result.lifecycle).toBe("confirmed");
    expect(result).not.toHaveProperty("invoiceStatus");
  });

  it("accepts structured tax exemption details", () => {
    const line = makeLine({ exemption: { code: "E01", reason: "Exempt supply" } });
    const result = financialTransactionSchema.parse(
      makeTransaction({ lines: [line], totals: calculateTransactionTotals([line]) }),
    );

    expect(result.lines[0].taxTreatment).toMatchObject({
      taxTypeCode: "EXEMPT",
      taxRate: "0",
      taxAmount: { amount: "0.00", currency: "MYR" },
      exemption: { code: "E01", reason: "Exempt supply" },
    });
  });

  it("requires a decimal exchange rate for foreign-currency transactions", () => {
    const line = makeLine({ currency: "USD", unitPrice: "25.50" });
    const transaction = makeTransaction({
      currency: "USD",
      exchangeRateToMYR: "4.7215",
      lines: [line],
      totals: calculateTransactionTotals([line]),
    });

    expect(financialTransactionSchema.safeParse(transaction).success).toBe(true);
    const withoutRate = { ...transaction, exchangeRateToMYR: undefined };
    expect(financialTransactionSchema.safeParse(withoutRate).success).toBe(false);
  });

  it("calculates a discounted line using decimal-safe values", () => {
    const line = makeLine({ quantity: "2", unitPrice: "50", discount: "10" });
    expect(line.subtotal.amount).toBe("100.00");
    expect(line.totalExcludingTax.amount).toBe("90.00");
    expect(line.totalIncludingTax.amount).toBe("90.00");
  });

  it("calculates line charges and tax without floating-point drift", () => {
    const line = makeLine({ quantity: "3", unitPrice: "0.10", charges: ["0.05"], taxRate: "8" });
    expect(line.subtotal.amount).toBe("0.30");
    expect(line.totalExcludingTax.amount).toBe("0.35");
    expect(line.taxTreatment.taxAmount.amount).toBe("0.03");
    expect(line.totalIncludingTax.amount).toBe("0.38");
  });

  it("links one transaction to multiple source documents and extraction runs", () => {
    const result = financialTransactionSchema.parse(
      makeTransaction({
        sourceLinks: [
          {
            sourceDocumentId: "source_receipt_001",
            extractionRunId: "extraction_receipt_001",
            relationship: "primary",
          },
          {
            sourceDocumentId: "source_bank_001",
            extractionRunId: "extraction_bank_001",
            relationship: "supporting",
            evidenceNotes: "Payment appears on statement.",
          },
        ],
      }),
    );

    expect(result.sourceLinks).toHaveLength(2);
  });

  it("reports document total reconciliation failures", () => {
    const line = makeLine();
    const totals = calculateTransactionTotals([line]);
    const corruptedTotals = { ...totals, payableAmount: money("99.99") };
    const reconciliation = reconcileTransactionTotals([line], corruptedTotals);

    expect(reconciliation.matches).toBe(false);
    expect(reconciliation.differences.map((difference) => difference.field)).toContain("payableAmount");
    expect(
      financialTransactionSchema.safeParse(
        makeTransaction({ lines: [line], totals: corruptedTotals }),
      ).success,
    ).toBe(false);
  });

  it.each<EInvoiceTreatment>([
    "individual",
    "consolidated_candidate",
    "self_billed_candidate",
    "not_required",
    "undetermined",
  ])("accepts e-Invoice treatment %s independently of direction", (eInvoiceTreatment) => {
    expect(
      financialTransactionSchema.safeParse(
        makeTransaction({ direction: "expense", eInvoiceTreatment }),
      ).success,
    ).toBe(true);
  });

  it("migrates canonical demo fixtures while preserving the existing UI adapter", () => {
    expect(DEMO_FINANCIAL_TRANSACTIONS).toHaveLength(6);
    expect(DEMO_FINANCIAL_TRANSACTIONS.every((transaction) => typeof transaction.totals.payableAmount.amount === "string")).toBe(true);
    expect(DEMO_TRANSACTIONS.map((transaction) => transaction.total)).toEqual([480, 86.4, 850, 126.4, 78, 620]);
    expect(DEMO_TRANSACTIONS.filter((transaction) => transaction.status === "needs_review")).toHaveLength(2);
  });
});
