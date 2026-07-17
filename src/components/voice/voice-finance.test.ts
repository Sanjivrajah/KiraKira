import { describe, expect, it } from "vitest";
import type { Transaction } from "@/types";
import {
  kualaLumpurToday,
  outstandingBalances,
  resolveFinancePeriod,
  summarizeTransactions,
} from "./voice-finance";

const txn = (overrides: Partial<Transaction>): Transaction => ({
  id: crypto.randomUUID(),
  businessId: "biz",
  createdBy: "user",
  type: "expense",
  status: "confirmed",
  sourceType: "voice",
  date: "2026-07-10",
  counterpartyName: "",
  description: "Test",
  category: "General",
  currency: "MYR",
  subtotal: 10,
  tax: 0,
  total: 10,
  items: [],
  createdAt: "2026-07-10T00:00:00.000Z",
  updatedAt: "2026-07-10T00:00:00.000Z",
  ...overrides,
});

describe("kualaLumpurToday", () => {
  it("resolves the KL calendar date (UTC+8)", () => {
    // 2026-07-16 23:00 UTC is already 2026-07-17 07:00 in Kuala Lumpur.
    expect(kualaLumpurToday(new Date("2026-07-16T23:00:00Z"))).toBe("2026-07-17");
  });
});

describe("resolveFinancePeriod", () => {
  const now = new Date("2026-07-17T02:00:00Z"); // 10:00 KL on 2026-07-17
  it("bounds this_month from the first of the month to today", () => {
    expect(resolveFinancePeriod("this_month", now)).toMatchObject({ start: "2026-07-01", end: "2026-07-17" });
  });
  it("bounds last_month across the full previous month", () => {
    expect(resolveFinancePeriod("last_month", now)).toMatchObject({ start: "2026-06-01", end: "2026-06-30" });
  });
  it("returns unbounded range for all time", () => {
    expect(resolveFinancePeriod("all", now)).toMatchObject({ start: null, end: null });
  });
});

describe("summarizeTransactions", () => {
  const period = resolveFinancePeriod("this_month", new Date("2026-07-17T02:00:00Z"));
  it("sums confirmed income and expenses and derives profit and top categories", () => {
    const summary = summarizeTransactions(
      [
        txn({ type: "income", total: 200, date: "2026-07-05" }),
        txn({ type: "expense", total: 45.5, category: "Fuel", date: "2026-07-06" }),
        txn({ type: "expense", total: 30, category: "Fuel", date: "2026-07-07" }),
        txn({ type: "expense", total: 20, category: "Food", date: "2026-07-08" }),
        txn({ type: "expense", total: 999, date: "2026-06-30" }), // outside the period
        txn({ type: "income", total: 999, status: "draft", date: "2026-07-09" }), // not confirmed
      ],
      period,
    );
    expect(summary.income).toBe(200);
    expect(summary.expenses).toBe(95.5);
    expect(summary.estimatedProfit).toBe(104.5);
    expect(summary.transactionCount).toBe(4);
    expect(summary.topExpenseCategories[0]).toEqual(["Fuel", 75.5]);
  });
  it("returns zeros for an empty period", () => {
    expect(summarizeTransactions([], period)).toMatchObject({ income: 0, expenses: 0, transactionCount: 0 });
  });
});

describe("outstandingBalances", () => {
  it("orders overdue balances first and excludes drafts, voids, and paid invoices", () => {
    const balances = outstandingBalances(
      [
        { invoiceNumber: "INV-1", customerName: "Ali", status: "sent", total: 100, amountPaid: 0, dueDate: "2026-07-01" },
        { invoiceNumber: "INV-2", customerName: "Mei", status: "partially_paid", total: 200, amountPaid: 150, dueDate: "2026-08-01" },
        { invoiceNumber: "INV-3", customerName: "Sri", status: "paid", total: 50, amountPaid: 50, dueDate: "2026-07-01" },
        { invoiceNumber: "INV-4", customerName: "Kai", status: "draft", total: 80, amountPaid: 0, dueDate: "2026-07-01" },
        { invoiceNumber: "INV-5", customerName: "Lim", status: "void", total: 80, amountPaid: 0, dueDate: "2026-07-01" },
      ],
      "2026-07-17",
    );
    expect(balances.map((balance) => balance.invoiceNumber)).toEqual(["INV-1", "INV-2"]);
    expect(balances[0]).toMatchObject({ outstanding: 100, overdue: true });
    expect(balances[1]).toMatchObject({ outstanding: 50, overdue: false });
  });
});
