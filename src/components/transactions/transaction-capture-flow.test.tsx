import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { repositories } from "@/repositories";
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
    await waitFor(async () => expect(await repositories.transactions.list({ businessId: "business_demo" })).toHaveLength(1));
    expect((await repositories.transactions.list({ businessId: "business_demo" }))[0]).toMatchObject({ total: 125.5, status: "confirmed", sourceType: "manual", counterpartyName: "Kedai Murni" });
  });
});
