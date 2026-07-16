import { describe, expect, it } from "vitest";
import { DEMO_TRANSACTIONS } from "@/data/demo";
import { calculateMonthlyMetrics, emptyTransactionFilters, filterAndSortTransactions } from "./query";

describe("transaction queries", () => {
  it("searches counterparties and combines filters", () => {
    const result = filterAndSortTransactions(DEMO_TRANSACTIONS, {
      ...emptyTransactionFilters,
      search: "maju mart",
      type: "expense",
      status: "needs_review",
    }, "newest");
    expect(result.map((item) => item.id)).toEqual(["txn_002"]);
  });

  it("supports every amount and date sort direction without mutating input", () => {
    const original = [...DEMO_TRANSACTIONS];
    expect(filterAndSortTransactions(DEMO_TRANSACTIONS, emptyTransactionFilters, "highest")[0].total).toBe(850);
    expect(filterAndSortTransactions(DEMO_TRANSACTIONS, emptyTransactionFilters, "lowest")[0].total).toBe(78);
    expect(filterAndSortTransactions(DEMO_TRANSACTIONS, emptyTransactionFilters, "oldest")[0].id).toBe("txn_006");
    expect(DEMO_TRANSACTIONS).toEqual(original);
  });

  it("calculates income, expenses, and profit for the selected month", () => {
    expect(calculateMonthlyMetrics(DEMO_TRANSACTIONS, new Date("2026-07-20T00:00:00Z"))).toEqual({
      revenue: 1950,
      expenses: 290.8,
      profit: 1659.2,
    });
  });
});
