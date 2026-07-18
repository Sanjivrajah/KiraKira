import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LoanReadinessResult } from "@/domain/loan-readiness";
import { LoanReadinessWorkspace } from "./loan-readiness-workspace";

const mutate = vi.fn();
let readinessState: { data?: LoanReadinessResult; isPending: boolean; isError: boolean };
let simulationState: { data?: LoanReadinessResult; isPending: boolean; isError: boolean };

function assessment(overrides: Partial<LoanReadinessResult> = {}): LoanReadinessResult {
  return {
    status: "ready",
    assessmentMonths: 8,
    confirmedCoverage: 0.875,
    averageMonthlyCfads: 4800,
    existingDebtService: 350,
    proposedInstalment: 939.56,
    totalDebtService: 1289.56,
    dscr: 2.31,
    maximumMonthlyRepayment: 3490,
    potentialLoanAmount: 111000,
    potentialLoanAssumptions: { annualRatePercent: 8, tenureMonths: 36 },
    scenarios: { baseDscr: 2.31, cautiousDscr: 1.98, stressedDscr: 1.54 },
    inferredDebts: [{ id: "debt-1", monthlyRepayment: 350, confidence: 0.92, sourceTransactionIds: ["transaction-1"] }],
    monthlyCfads: [],
    dataIssues: [],
    disclaimer: "Indicative cash-flow assessment only. It is not a lender decision, financing offer, credit score, or financial advice.",
    ...overrides,
  };
}

vi.mock("@/hooks/use-business", () => ({
  useBusiness: () => ({ data: { id: "business-1" } }),
}));

vi.mock("@/hooks/use-loan-readiness", () => ({
  useLoanReadiness: () => readinessState,
  useLoanSimulation: () => ({ ...simulationState, mutate }),
}));

beforeEach(() => {
  mutate.mockReset();
  readinessState = { data: assessment(), isPending: false, isError: false };
  simulationState = { isPending: false, isError: false };
});

describe("LoanReadinessWorkspace", () => {
  it("presents the financing header, accessible terms form, and indicative assessment", () => {
    const { container } = render(<LoanReadinessWorkspace />);

    expect(screen.getByText("Financing preparation")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Loan readiness" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Financing amount (MYR)" })).toHaveValue(30000);
    expect(screen.getByRole("spinbutton", { name: "Annual interest rate (%)" })).toHaveValue(8);
    expect(screen.getByRole("spinbutton", { name: "Tenure (months)" })).toHaveValue(36);
    expect(screen.getByRole("button", { name: "Calculate affordability" })).toBeEnabled();
    expect(screen.getByRole("region", { name: "Readiness summary" })).toHaveTextContent("Ready");
    expect(screen.getByText(/illustrative 8% annual rate over 36 monthly instalments/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/111,000\.00/)).toBeInTheDocument();
    expect(document.querySelector(".loan-readiness-money-group")).toHaveTextContent(",");
    expect(document.querySelector(".loan-readiness-money-decimal")).toHaveTextContent(".");
    expect(screen.getByText("Proposed instalment")).toBeInTheDocument();
    expect(screen.getByText("Cautious case")).toBeInTheDocument();
    expect(screen.getByText(/1 recurring debt obligation is included/i)).toBeInTheDocument();
    expect(screen.getAllByText(/not a lender decision/i)).toHaveLength(2);
    const leftColumn = container.querySelector(".loan-readiness-left-column");
    expect(leftColumn).toContainElement(screen.getByRole("region", { name: "Readiness summary" }));
    expect(leftColumn).toContainElement(screen.getByRole("heading", { name: "Try your loan terms" }));
    expect(container.querySelector(".loan-readiness-workspace > .loan-readiness-capacity")).toBeInTheDocument();
  });

  it("submits the entered terms and shows a calculation error safely", () => {
    simulationState = { isPending: false, isError: true };
    render(<LoanReadinessWorkspace />);

    fireEvent.change(screen.getByRole("spinbutton", { name: "Financing amount (MYR)" }), { target: { value: "45000" } });
    fireEvent.click(screen.getByRole("button", { name: "Calculate affordability" }));

    expect(mutate).toHaveBeenCalledWith({ principal: 45000, annualRatePercent: 8, tenureMonths: 36 });
    expect(screen.getByRole("alert")).toHaveTextContent("We could not calculate those terms");
  });

  it("explains incomplete history and no inferred debt records", () => {
    readinessState = {
      data: assessment({
        status: "insufficient_data",
        assessmentMonths: 3,
        confirmedCoverage: 0.5,
        inferredDebts: [],
        dataIssues: ["At least six consecutive completed months of confirmed records are needed.", "Less than 80% of recorded transactions are confirmed."],
      }),
      isPending: false,
      isError: false,
    };
    render(<LoanReadinessWorkspace />);

    expect(screen.getAllByText("More history needed")).toHaveLength(2);
    expect(screen.getByText(/At least six consecutive completed months/i)).toBeInTheDocument();
    expect(screen.getByText(/No recurring debt obligations were inferred/i)).toBeInTheDocument();
  });

  it("uses the existing loading and load-error recovery states", () => {
    readinessState = { isPending: true, isError: false };
    const { rerender } = render(<LoanReadinessWorkspace />);
    expect(screen.getByText("Calculating loan readiness")).toBeInTheDocument();

    readinessState = { isPending: false, isError: true };
    rerender(<LoanReadinessWorkspace />);
    expect(screen.getByRole("alert")).toHaveTextContent("We could not load loan readiness");
  });
});
