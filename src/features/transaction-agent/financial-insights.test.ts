import { describe, expect, it } from "vitest";
import { calculateFinancialInsight, formatFinancialInsight, parseFinancialInsightQuery } from "./financial-insights";
import type { ConfirmedTransaction } from "./transaction-record.schema";

const record = (overrides: Partial<ConfirmedTransaction>): ConfirmedTransaction => ({ id: crypto.randomUUID(), telegramUserId: "owner", telegramChatId: "chat", sourceType: "telegram_text", originalInput: "synthetic", type: "income", amount: 100, currency: "MYR", description: "Sale", merchantOrCustomer: null, paymentMethod: "cash", transactionDate: "2026-07-01", category: "Sales", quantity: null, unit: null, confidence: 1, status: "confirmed", confirmedAt: "2026-07-01T00:00:00.000Z", createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z", ...overrides });

describe("financial insights", () => {
  const records = [record({ amount: 100, type: "income", category: "Sales" }), record({ amount: 40, type: "expense", category: "Food", transactionDate: "2026-07-31" }), record({ amount: 20, type: "customer_payment", transactionDate: "2026-07-15" }), record({ amount: 999, type: "expense", status: "voided" }), record({ amount: 999, type: "expense", transactionDate: "2026-08-01" })];
  it("calculates bounded, confirmed sales, expenses, profit, cash, and categories", () => {
    const data = calculateFinancialInsight({ kind: "profit_summary", dateRange: { from: "2026-07-01", to: "2026-07-31" } }, records, [], new Date("2026-07-31T16:30:00.000Z"));
    expect(data).toMatchObject({ income: 100, expenses: 40, customerPayments: 20, estimatedProfit: 60, netCashMovement: 80, transactionCount: 3, categories: [["Food", 40]] });
    expect(formatFinancialInsight({ kind: "profit_vs_cash" }, data)).toContain("customer payments");
  });
  it("handles empty periods, partial receivables, and unavailable receivables safely", () => {
    const empty = calculateFinancialInsight({ kind: "sales_expenses", dateRange: { from: "2026-06-01", to: "2026-06-30" } }, records, [], new Date());
    expect(empty.transactionCount).toBe(0);
    const outstanding = calculateFinancialInsight({ kind: "outstanding_receivables" }, records, [{ id: crypto.randomUUID(), telegramUserId: "owner", telegramChatId: "chat", customerDisplayName: "Ali", originalAmount: 50, outstandingAmount: 20, currency: "MYR", issuedOn: "2026-07-01", dueOn: null, status: "partially_paid", notes: null, source: "telegram", createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z", settledAt: null, voidedAt: null, voidReason: null }], new Date());
    expect(outstanding.outstandingReceivables).toBe(20);
    expect(calculateFinancialInsight({ kind: "outstanding_receivables" }, records, null).outstandingReceivables).toBeNull();
  });
  it("routes only supported questions and validates malformed date ranges", () => {
    expect(parseFinancialInsightQuery("what is my profit 2026-07-31 to 2026-07-01")).toBeNull();
    expect(parseFinancialInsightQuery("show biggest expense categories")).toMatchObject({ kind: "expense_categories" });
    expect(parseFinancialInsightQuery("write an invoice")).toBeNull();
  });
});
