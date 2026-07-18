import { describe, expect, it } from "vitest";
import { calculateInvoiceTotals, calculateInvoiceTotalsMinor, daysFromDueDate, getEffectiveInvoiceStatus, getInvoiceReadinessChecks } from "./calculations";

describe("invoice calculations", () => {
  it("calculates persistence totals in integer minor units with rounded tax", () => {
    expect(calculateInvoiceTotalsMinor([{ quantity: 3, unitPrice: 19.99, taxRate: 6, discountAmount: 0.01 }]))
      .toEqual({ subtotalMinor: 5996, taxMinor: 360, totalMinor: 6356 });
  });

  it("calculates subtotal, line taxes, and total to cents", () => {
    expect(calculateInvoiceTotals([
      { quantity: 2, unitPrice: 10.25, taxRate: 8 },
      { quantity: 3, unitPrice: 4.1, taxRate: 0 },
    ])).toEqual({ subtotal: 32.8, tax: 1.64, total: 34.44 });
  });

  it("classifies sent invoices after their due date as overdue", () => {
    const today = new Date(2026, 6, 14);
    expect(daysFromDueDate("2026-07-10", today)).toBe(4);
    expect(getEffectiveInvoiceStatus({ status: "sent", dueDate: "2026-07-10" }, today)).toBe("overdue");
    expect(getEffectiveInvoiceStatus({ status: "paid", dueDate: "2026-07-10" }, today)).toBe("paid");
  });

  it("reports exactly which readiness details are present", () => {
    const checks = getInvoiceReadinessChecks({
      business: { name: "Lina Kitchen", type: "food_beverage", registrationNumber: "202601234567", tin: "C123", currency: "MYR", preferredLanguage: "en" },
      customerName: "Kedai Murni", buyerTin: "", issueDate: "2026-07-14",
      items: [{ description: "Catering", quantity: 1, unitPrice: 850, taxRate: 0 }],
    });
    expect(checks).toHaveLength(8);
    expect(checks.find((item) => item.label === "Buyer TIN placeholder")?.ready).toBe(false);
    expect(checks.filter((item) => item.ready)).toHaveLength(7);
  });
});
