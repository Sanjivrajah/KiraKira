import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { render } from "@/test/render";
import { CashFlowWorkspace } from "./cash-flow-workspace";

describe("CashFlowWorkspace", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("groups the reporting context and totals in an accessible summary section", async () => {
    const { container } = render(<CashFlowWorkspace now="2026-07-15T09:00:00.000Z" />);

    const summary = await screen.findByRole("region", { name: "Cash-flow summary" });
    const summaryQueries = within(summary);
    expect(summary).toContainElement(summaryQueries.getByText("Reporting window"));
    expect(summary.querySelector("dl")).toHaveAccessibleName("Cash-flow totals");
    expect(summaryQueries.getByText("Money in")).toBeInTheDocument();
    expect(summaryQueries.getByText("Money out")).toBeInTheDocument();
    expect(summaryQueries.getByText("Net movement")).toBeInTheDocument();
    expect(container.querySelector(".cash-flow-totals")).toBeInTheDocument();
  });
});
