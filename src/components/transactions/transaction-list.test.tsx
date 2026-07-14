import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { getTransactionById } from "@/lib/transactions/storage";
import { TransactionList } from "./transaction-list";

describe("TransactionList", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, "", "/transactions");
  });

  it("seeds demo records and filters by search", () => {
    render(<TransactionList />);
    expect(screen.getAllByText("Morning nasi lemak sales").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByPlaceholderText("Search description or name"), { target: { value: "Suria Events" } });
    expect(screen.getAllByText("Catering deposit for 40 guests").length).toBeGreaterThan(0);
    expect(screen.queryByText("Morning nasi lemak sales")).not.toBeInTheDocument();
  });

  it("marks a needs-review transaction as reviewed and persists it", () => {
    render(<TransactionList />);
    fireEvent.click(screen.getAllByRole("button", { name: "Mark reviewed" })[0]);
    expect(getTransactionById("txn_002")?.status).toBe("confirmed");
    expect(screen.getByRole("status")).toHaveTextContent("marked as reviewed");
  });
});
