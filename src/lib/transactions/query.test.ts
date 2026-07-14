import { describe, expect, it } from "vitest";
import { mockTransactions } from "@/data/mock-transactions";
import { calculateMonthlyMetrics, emptyTransactionFilters, filterAndSortTransactions } from "./query";

describe("transaction queries", () => {
  it("searches counterparties and combines filters", () => {
    const result = filterAndSortTransactions(mockTransactions, {
      ...emptyTransactionFilters,
      search: "maju mart",
      type: "expense",
      status: "needs_review",
    }, "newest");
    expect(result.map((item) => item.id)).toEqual(["txn_002"]);
  });

  it("supports every amount and date sort direction without mutating input", () => {
    const original = [...mockTransactions];
    expect(filterAndSortTransactions(mockTransactions, emptyTransactionFilters, "highest")[0].total).toBe(850);
    expect(filterAndSortTransactions(mockTransactions, emptyTransactionFilters, "lowest")[0].total).toBe(78);
    expect(filterAndSortTransactions(mockTransactions, emptyTransactionFilters, "oldest")[0].id).toBe("txn_006");
    expect(mockTransactions).toEqual(original);
  });

  it("calculates income, expenses, and profit for the selected month", () => {
    expect(calculateMonthlyMetrics(mockTransactions, new Date("2026-07-20T00:00:00Z"))).toEqual({
      revenue: 1950,
      expenses: 290.8,
      profit: 1659.2,
    });
  });
});
