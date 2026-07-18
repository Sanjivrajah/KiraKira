import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CashOverview } from "./cash-overview";

function normalizedText() {
  return document.body.textContent?.replace(/\u00a0/g, " ") ?? "";
}

describe("CashOverview", () => {
  it("shows proportional gross income and expense bars", () => {
    render(<CashOverview data={[
      { month: "May", monthKey: "2026-05", income: 0, expenses: 0, net: 0 },
      { month: "Jun", monthKey: "2026-06", income: 0, expenses: 50_000, net: -50_000 },
      { month: "Jul", monthKey: "2026-07", income: 200_000, expenses: 58_100, net: 141_900 },
    ]} />);

    expect(screen.getByText("Last 6 months net cash flow")).toBeInTheDocument();
    expect(screen.getByText("Income")).toBeInTheDocument();
    expect(screen.getByText("Expenses")).toBeInTheDocument();
    expect(normalizedText()).toContain("+RM 91,900.00");
    expect(normalizedText()).not.toContain("RM 0.00");

    expect(document.querySelector("[data-tooltip]")).not.toBeInTheDocument();
    expect(document.querySelectorAll(".chart-bar.expenses")[1]).toHaveStyle({ height: "25%" });
    expect(document.querySelectorAll(".chart-bar.income")[2]).toHaveStyle({ height: "100%" });
  });
});
