import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { getTransactions } from "@/lib/transactions/storage";
import { TransactionCaptureFlow } from "./transaction-capture-flow";

describe("TransactionCaptureFlow", () => {
  beforeEach(() => localStorage.clear());

  it("shows every Session 3 input method", () => {
    render(<TransactionCaptureFlow />);
    expect(screen.getAllByRole("button", { name: /Receipt photo|Voice note|Manual entry|CSV import|Bank statement|WhatsApp order/ })).toHaveLength(6);
  });

  it("validates and saves a manual transaction as reviewed", async () => {
    render(<TransactionCaptureFlow initialMethod="manual" />);

    fireEvent.change(screen.getByLabelText("Amount (RM)"), { target: { value: "125.50" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Sales" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Lunch order" } });
    fireEvent.change(screen.getByLabelText("Customer name (optional)"), { target: { value: "Kedai Murni" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirm and save/ }));

    expect(await screen.findByRole("heading", { name: "Transaction added" })).toBeInTheDocument();
    await waitFor(() => expect(getTransactions()).toHaveLength(1));
    expect(getTransactions()[0]).toMatchObject({ amount: 125.5, status: "reviewed", source: "manual", customerName: "Kedai Murni" });
  });
});
