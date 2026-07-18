import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { repositories } from "@/repositories";
import { FRONTEND_STORAGE_KEYS } from "@/frontend/storage";
import { render } from "@/test/render";
import { TransactionCaptureFlow } from "./transaction-capture-flow";

describe("TransactionCaptureFlow", () => {
  beforeEach(() => localStorage.clear());

  it("mounts one stage wrapper when moving from source selection to input", () => {
    const { container } = render(<TransactionCaptureFlow />);

    expect(container.querySelector('[data-stage="select"]')).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Receipt photos/ }));

    expect(container.querySelector('[data-stage="input"]')).toBeInTheDocument();
    expect(container.querySelectorAll(".capture-stage")).toHaveLength(1);
  });

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

  it("keeps every imported CSV row in Records while the owner reviews the batch", async () => {
    const { container } = render(<TransactionCaptureFlow initialMethod="csv" />);
    const csv = [
      "date,description,debit,credit,merchant,category,payment method\n",
      "2026-07-13,Groceries,86.40,,Maju Mart,Inventory,Debit card\n",
      "2026-07-12,Catering payment,,850.00,Suria Events,Catering,Bank transfer\n",
    ].join("");
    const file = new File(["placeholder"], "transactions.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", { value: () => Promise.resolve(csv) });

    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Import transactions" }));

    expect(await screen.findByText("Checking transaction 1 of 2")).toBeInTheDocument();
    await waitFor(async () => {
      expect(await repositories.transactions.list({ businessId: "business_demo" })).toEqual(expect.arrayContaining([
        expect.objectContaining({ description: "Groceries", status: "needs_review" }),
        expect.objectContaining({ description: "Catering payment", status: "needs_review" }),
      ]));
    });
  });

  it("updates an imported pending record when the owner approves it", async () => {
    const { container } = render(<TransactionCaptureFlow initialMethod="csv" />);
    const file = new File(["placeholder"], "transactions.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", {
      value: () => Promise.resolve("date,type,amount,description\n2026-07-13,expense,86.40,Groceries"),
    });

    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Import transactions" }));
    const approveButton = await screen.findByRole("button", { name: "Approve record" });
    await waitFor(() => expect(approveButton).toBeEnabled());
    fireEvent.click(approveButton);

    expect(await screen.findByRole("heading", { name: "Record approved" })).toBeInTheDocument();
    await waitFor(async () => {
      expect(await repositories.transactions.list({ businessId: "business_demo" })).toEqual([
        expect.objectContaining({ description: "Groceries", status: "confirmed" }),
      ]);
    });
  });

  it("loads a saved pending record into the editable approval flow", async () => {
    render(<TransactionCaptureFlow initialMethod="voice" reviewTransactionId="txn_004" />);

    expect(await screen.findByRole("heading", { name: "Compare the evidence with the prepared draft" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText("Amount (RM)")).toHaveValue(126.4);
      expect(screen.getByLabelText("Description")).toHaveValue("Weekly grocery purchase");
    });

    fireEvent.click(screen.getByRole("button", { name: "Approve record" }));
    expect(await screen.findByRole("heading", { name: "Record approved" })).toBeInTheDocument();
    await waitFor(async () => {
      expect((await repositories.transactions.getById({ businessId: "business_demo", transactionId: "txn_004" }))?.status).toBe("confirmed");
    });
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
