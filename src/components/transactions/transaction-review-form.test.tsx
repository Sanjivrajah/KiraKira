import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { TransactionReviewForm, type TransactionDraft } from "./transaction-review-form";

const draft: TransactionDraft = {
  type: "expense",
  date: "2026-07-13",
  amount: 68.4,
  category: "Inventory",
  description: "Cooking ingredients and packaging",
  counterpartyName: "Maju Mart",
  paymentMethod: "Debit card",
  source: "receipt",
  eInvoiceTreatment: "self_billed_candidate",
  fieldConfidence: { amount: 0.58, merchant: 0.97 },
};

describe("TransactionReviewForm", () => {
  it("keeps evidence visible and turns uncertainty into a field-level task", () => {
    render(<TransactionReviewForm
      draft={draft}
      onBack={vi.fn()}
      onConfirm={vi.fn()}
      sourceEvidence={{ label: "Receipt text", text: "TOTAL RM 86.40" }}
    />);

    expect(screen.getByRole("heading", { name: "Evidence used" })).toBeInTheDocument();
    expect(screen.getByText("TOTAL RM 86.40")).toBeInTheDocument();
    expect(screen.getByText("Check amount")).toBeInTheDocument();
    expect(screen.queryByText(/58%/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("E-Invoice treatment")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Check field" }));
    expect(screen.getByLabelText("Amount (RM)")).toHaveFocus();
  });

  it("uses owner approval language and submits corrected values", async () => {
    const onConfirm = vi.fn();
    render(<TransactionReviewForm draft={draft} onBack={vi.fn()} onConfirm={onConfirm} />);

    fireEvent.change(screen.getByLabelText("Amount (RM)"), { target: { value: "86.40" } });
    fireEvent.click(screen.getByRole("button", { name: "Approve record" }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ amount: 86.4 }), expect.anything()));
  });
});
