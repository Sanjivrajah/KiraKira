import { describe, expect, it } from "vitest";
import { assessReadiness, monthlyInstalment, principalForPayment } from "./loan-readiness-calculations";

describe("loan readiness calculations", () => {
  it("calculates a zero-rate monthly repayment", () => {
    expect(monthlyInstalment({ principal: 12_000, annualRatePercent: 0, tenureMonths: 12 })).toBe(1000);
  });

  it("inverts a monthly payment to its principal", () => {
    const payment = monthlyInstalment({ principal: 20_000, annualRatePercent: 8, tenureMonths: 36 });
    expect(principalForPayment(payment, 8, 36)).toBeCloseTo(20_000, 0);
  });

  it("does not produce a positive readiness status without six months", () => {
    const transactions = ["01", "02", "03"].flatMap((month, index) => [
      { id: `00000000-0000-4000-8000-00000000000${index}`, date: `2026-${month}-15`, direction: "income" as const, lifecycle: "confirmed" as const, categoryCode: "sales", amount: 5_000, confidence: 1 },
      { id: `10000000-0000-4000-8000-00000000000${index}`, date: `2026-${month}-18`, direction: "expense" as const, lifecycle: "confirmed" as const, categoryCode: "rent", amount: 1_000, confidence: 1 },
    ]);
    expect(assessReadiness({ transactions, terms: { principal: 10_000, annualRatePercent: 8, tenureMonths: 36 } }).status).toBe("insufficient_data");
  });

  it("requires consecutive history and includes loss-making months in capacity", () => {
    const transactions = ["01", "02", "04", "05", "06", "07"].flatMap((month, index) => [
      { id: `20000000-0000-4000-8000-00000000000${index}`, date: `2026-${month}-15`, direction: "income" as const, lifecycle: "confirmed" as const, categoryCode: "sales", amount: 1000, confidence: 1 },
      { id: `30000000-0000-4000-8000-00000000000${index}`, date: `2026-${month}-18`, direction: "expense" as const, lifecycle: "confirmed" as const, categoryCode: "rent", amount: index === 0 ? 3000 : 500, confidence: 1 },
    ]);
    const result = assessReadiness({ transactions });
    expect(result.status).toBe("insufficient_data");
    expect(result.averageMonthlyCfads).toBeLessThan(500);
  });

  it("keeps indicative capacity when six-month cash flow and the latest quarter are positive", () => {
    const monthly = [
      ["02", 2_450, 1_280.5],
      ["03", 3_200, 486.4],
      ["04", 1_850, 188],
      ["05", 980, 140],
      ["06", 0, 51_200],
      ["07", 201_470, 58_264.4],
    ] as const;
    const transactions = monthly.flatMap(([month, income, expenses], index) => [
      ...(income ? [{ id: `40000000-0000-4000-8000-00000000000${index}`, date: `2026-${month}-15`, direction: "income" as const, lifecycle: "confirmed" as const, categoryCode: "sales", amount: income, confidence: 1 }] : []),
      { id: `50000000-0000-4000-8000-00000000000${index}`, date: `2026-${month}-18`, direction: "expense" as const, lifecycle: "confirmed" as const, categoryCode: "operating-expense", amount: expenses, confidence: 1 },
    ]);

    const result = assessReadiness({ transactions });

    expect(result.averageMonthlyCfads).toBe(16_398.45);
    expect(result.maximumMonthlyRepayment).toBeGreaterThan(0);
    expect(result.potentialLoanAmount).toBeGreaterThan(0);
  });
});
