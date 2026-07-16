import { describe, expect, it } from "vitest";
import { DEMO_BUSINESS, DEMO_INVOICES, DEMO_TRANSACTIONS } from "@/data/demo";
import { deriveCashFlow, deriveDashboardInsights, deriveDashboardMetrics, deriveLoanReadiness } from "./derive";

const now = new Date("2026-07-14T04:00:00.000Z");

describe("dashboard derivation", () => {
  it("derives financial metrics and overdue invoices from records", () => {
    expect(deriveDashboardMetrics(DEMO_TRANSACTIONS, DEMO_INVOICES, now)).toEqual({
      revenue: 1950,
      expenses: 290.8,
      profit: 1659.2,
      profitMargin: (1659.2 / 1950) * 100,
      outstandingPayments: 1470,
      overdueInvoiceCount: 1,
    });
  });

  it("handles empty records, zero revenue, and negative profit", () => {
    expect(deriveDashboardMetrics([], [], now)).toMatchObject({ revenue: 0, profit: 0, profitMargin: null, outstandingPayments: 0, overdueInvoiceCount: 0 });
    const metrics = deriveDashboardMetrics([DEMO_TRANSACTIONS[1]], [], now);
    expect(metrics.profit).toBe(-86.4);
    expect(metrics.profitMargin).toBeNull();
  });

  it("derives deterministic cash-flow points from transaction dates", () => {
    const points = deriveCashFlow(DEMO_TRANSACTIONS, now);
    expect(points).toHaveLength(6);
    expect(points.at(-1)).toMatchObject({ month: "Jul", monthKey: "2026-07", income: 1950, expenses: 290.8, net: 1659.2 });
  });

  it("creates review, overdue, and missing-profile insights from inputs", () => {
    const metrics = deriveDashboardMetrics(DEMO_TRANSACTIONS, DEMO_INVOICES, now);
    const insights = deriveDashboardInsights({ metrics, reviewCount: 2, business: DEMO_BUSINESS, cashFlow: deriveCashFlow(DEMO_TRANSACTIONS, now) });
    expect(insights.map((item) => item.id)).toEqual(["review", "overdue", "profile"]);
    expect(insights.find((item) => item.id === "overdue")?.description).toContain("RM");
  });

  it("derives a bounded readiness preview from current records", () => {
    const metrics = deriveDashboardMetrics(DEMO_TRANSACTIONS, DEMO_INVOICES, now);
    expect(deriveLoanReadiness({ transactions: DEMO_TRANSACTIONS, invoices: DEMO_INVOICES, metrics, reviewCount: 2, business: DEMO_BUSINESS })).toEqual({
      score: 70,
      summary: "Review 2 transactions to make your local records more complete.",
    });
  });
});
