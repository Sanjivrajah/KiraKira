import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { render } from "@/test/render";
import { TransactionList } from "./transaction-list";

describe("TransactionList", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, "", "/transactions");
  });

  it("seeds demo records and filters by search", async () => {
    render(<TransactionList />);
    expect((await screen.findAllByText("Morning nasi lemak sales")).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByPlaceholderText("Search description or name"), { target: { value: "Suria Events" } });
    expect(screen.getAllByText("Catering deposit for 40 guests").length).toBeGreaterThan(0);
    expect(screen.queryByText("Morning nasi lemak sales")).not.toBeInTheDocument();
  });

  it("routes the judged receipt through the evidence review flow", async () => {
    render(<TransactionList />);
    const reviewLinks = await screen.findAllByRole("link", { name: /Check record/ });
    expect(reviewLinks.some((link) => link.getAttribute("href") === "/transactions/new?method=receipt&demo=ambiguous&reviewId=txn_002")).toBe(true);
    expect(screen.queryByRole("button", { name: "Mark reviewed" })).not.toBeInTheDocument();
  });
});
