import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { repositories } from "@/repositories";
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

  it("marks a needs-review transaction as reviewed and persists it", async () => {
    render(<TransactionList />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Mark reviewed" }))[0]);
    await waitFor(async () => expect((await repositories.transactions.getById({ businessId: "business_demo", transactionId: "txn_002" }))?.status).toBe("confirmed"));
    expect(await screen.findByRole("status")).toHaveTextContent("marked as reviewed");
  });
});
