import { describe, expect, it } from "vitest";
import { activeInPeriod, escapeCsvCell, paginateTransactions, periodFor, searchTransactions, summaryForPeriod, validatePeriod } from "@/features/transaction-agent/daily-bookkeeping";
import type { ConfirmedTransaction } from "@/features/transaction-agent/transaction-record.schema";

const transaction = (id: string, date: string, overrides: Partial<ConfirmedTransaction> = {}): ConfirmedTransaction => ({
  id, telegramUserId: "owner", telegramChatId: "chat", sourceType: "telegram_text", originalInput: "sale", type: "income", amount: 10, currency: "MYR", description: "Nasi lemak", merchantOrCustomer: "Ravi", transactionDate: date, paymentMethod: "cash", category: "Food", quantity: null, unit: null, confidence: 1, status: "confirmed", createdAt: `${date}T01:00:00.000Z`, updatedAt: `${date}T01:00:00.000Z`, confirmedAt: `${date}T01:00:00.000Z`, ...overrides,
});

describe("daily bookkeeping", () => {
  it("calculates Malaysian week and month boundaries", () => {
    expect(periodFor("week", "Asia/Kuala_Lumpur", new Date("2026-07-15T10:00:00Z"))).toEqual({ start: "2026-07-13", end: "2026-07-15" });
    expect(periodFor("last_month", "Asia/Kuala_Lumpur", new Date("2026-07-15T10:00:00Z"))).toEqual({ start: "2026-06-01", end: "2026-06-30" });
    expect(validatePeriod("2026-07-15", "2026-07-01")).toBeNull();
  });
  it("keeps customer payments separate and voids out of summaries", () => {
    const records = [transaction("1", "2026-07-01"), transaction("2", "2026-07-02", { type: "customer_payment", amount: 25, category: null }), transaction("3", "2026-07-03", { status: "voided" })];
    const summary = summaryForPeriod(records, { start: "2026-07-01", end: "2026-07-31" });
    expect(summary).toMatchObject({ income: 10, customerPayments: 25, transactionCount: 2, categories: [["Uncategorized", 25], ["Food", 10]] });
    expect(activeInPeriod(records, { start: "2026-07-01", end: "2026-07-31" })).toHaveLength(2);
  });
  it("uses a cursor so a new record does not displace the next page", () => {
    const original = Array.from({ length: 12 }, (_, i) => transaction(String(i), `2026-07-${String(i + 1).padStart(2, "0")}`));
    const first = paginateTransactions(original, undefined, 5);
    const next = paginateTransactions([transaction("new", "2026-07-31"), ...original], first.nextCursor!, 5);
    expect(next.items.map((item) => item.id)).toEqual(["6", "5", "4", "3", "2"]);
  });
  it("normalizes search and escapes spreadsheet formulas", () => {
    expect(searchTransactions([transaction("1", "2026-07-01", { description: "Kopi café" })], "CAFE")).toHaveLength(1);
    expect(searchTransactions([transaction("1", "2026-07-01")], "x".repeat(121))).toEqual([]);
    expect(escapeCsvCell("=HYPERLINK(\"bad\")")).toBe("\"'=HYPERLINK(\"\"bad\"\")\"");
  });
});
