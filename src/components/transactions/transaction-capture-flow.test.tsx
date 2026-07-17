import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { repositories } from "@/repositories";
import { FRONTEND_STORAGE_KEYS } from "@/frontend/storage";
import { render } from "@/test/render";
import { TransactionCaptureFlow } from "./transaction-capture-flow";

describe("TransactionCaptureFlow", () => {
  beforeEach(() => localStorage.clear());

  it("shows every Session 3 input method", () => {
    render(<TransactionCaptureFlow />);
    expect(screen.getAllByRole("button", { name: /Receipt photo|Voice note|Manual entry|CSV import|Bank statement|Telegram order/ })).toHaveLength(6);
    expect(screen.getAllByText("Available")).toHaveLength(5);
  });

  it("validates and saves a manual transaction as reviewed", async () => {
    render(<TransactionCaptureFlow initialMethod="manual" />);

    fireEvent.change(screen.getByLabelText("Amount (RM)"), { target: { value: "125.50" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Sales" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Lunch order" } });
    fireEvent.change(screen.getByLabelText("Customer name (optional)"), { target: { value: "Kedai Murni" } });
    fireEvent.click(screen.getByRole("button", { name: "Approve record" }));

    expect(await screen.findByRole("heading", { name: "Record approved" })).toBeInTheDocument();
    await waitFor(async () => expect(await repositories.transactions.list({ businessId: "business_demo" })).toHaveLength(1));
    expect((await repositories.transactions.list({ businessId: "business_demo" }))[0]).toMatchObject({ total: 125.5, status: "confirmed", sourceType: "manual", counterpartyName: "Kedai Murni" });
  });

  it("runs the deterministic evidence correction through approval and audit history", async () => {
    render(<TransactionCaptureFlow demoScenario="ambiguous-receipt" initialMethod="receipt" reviewTransactionId="txn_002" />);

    expect(screen.getByText((content) => content.includes("TOTAL RM 86.40"))).toBeInTheDocument();
    expect(screen.getByLabelText("Amount (RM)")).toHaveValue(68.4);

    fireEvent.change(screen.getByLabelText("Amount (RM)"), { target: { value: "86.40" } });
    const approveButton = screen.getByRole("button", { name: "Approve record" });
    await waitFor(() => expect(approveButton).toBeEnabled());
    fireEvent.click(approveButton);

    expect(await screen.findByRole("heading", { name: "Record approved" })).toBeInTheDocument();
    expect(screen.getByText("Amount corrected")).toBeInTheDocument();
    expect(screen.getByText("68.40 → 86.4")).toBeInTheDocument();
    expect(screen.getByText("MyInvois status")).toBeInTheDocument();
    expect(screen.getByText("Not submitted")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(FRONTEND_STORAGE_KEYS.extractionRuns) || "[]")).toEqual([
      expect.objectContaining({ status: "approved", reviewedBy: "demo-lina", changedFields: [expect.objectContaining({ fieldPath: "total.amount" })] }),
    ]);
    const records = await repositories.transactions.list({ businessId: "business_demo" });
    expect(records).toHaveLength(6);
    expect(records.find((record) => record.id === "txn_002")).toMatchObject({ status: "confirmed", total: 86.4 });
  });
});
