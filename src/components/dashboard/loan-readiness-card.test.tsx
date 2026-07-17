import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoanReadinessCard } from "./loan-readiness-card";

describe("LoanReadinessCard", () => {
  it("renders indicative capacity and its financing-decision disclaimer", () => {
    render(<LoanReadinessCard assessment={{
      status: "ready", assessmentMonths: 12, confirmedCoverage: 0.9, averageMonthlyCfads: 5000,
      existingDebtService: 0, proposedInstalment: 0, totalDebtService: 0, dscr: null,
      maximumMonthlyRepayment: 4000, potentialLoanAmount: 1234567,
      potentialLoanAssumptions: { annualRatePercent: 8, tenureMonths: 36 }, inferredDebts: [], monthlyCfads: [], dataIssues: [],
      scenarios: { baseDscr: null, cautiousDscr: null, stressedDscr: null },
      disclaimer: "Indicative cash-flow assessment only. It is not a lender decision, financing offer, credit score, or financial advice.",
    }} />);
    expect(screen.getByText(/potential loan amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/1,234,567\.00/)).toBeInTheDocument();
    expect(screen.getByText(/not a lender decision/i)).toBeInTheDocument();
  });
});
