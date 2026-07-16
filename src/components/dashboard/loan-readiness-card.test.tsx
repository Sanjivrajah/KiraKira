import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoanReadinessCard } from "./loan-readiness-card";

describe("LoanReadinessCard", () => {
  it("renders the local-record and financing-decision disclaimers", () => {
    render(<LoanReadinessCard score={70} summary="A local preview." />);
    expect(screen.getByText(/based on current local records/i)).toBeInTheDocument();
    expect(screen.getByText(/not a financing decision/i)).toBeInTheDocument();
  });
});
