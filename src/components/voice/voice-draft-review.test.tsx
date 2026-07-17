import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createTransaction: { isPending: false, mutateAsync: vi.fn() },
  createInvoice: { isPending: false, mutateAsync: vi.fn() },
}));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ session: { user: { id: "user-1" } } }),
}));
vi.mock("@/hooks/use-business", () => ({
  useBusiness: () => ({ data: { id: "business-1" } }),
}));
vi.mock("@/hooks/use-transactions", () => ({ useCreateTransaction: () => mocks.createTransaction }));
vi.mock("@/hooks/use-invoices", () => ({ useCreateInvoice: () => mocks.createInvoice }));

import { VoiceDraftReview } from "./voice-draft-review";
import { useVoiceDraftStore } from "./voice-draft-store";

const transaction = {
  type: "expense" as const,
  date: "2026-07-17",
  amount: 45,
  category: "Fuel",
  description: "Petrol",
  counterpartyName: "Station Murni",
  paymentMethod: "Cash",
};

describe("VoiceDraftReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useVoiceDraftStore.getState().reset();
    useVoiceDraftStore.getState().setTransaction(transaction);
    mocks.createTransaction.mutateAsync.mockResolvedValue({ ...transaction, id: "txn-1", total: 45 });
  });

  it("shows a summary first and keeps editing behind an explicit disclosure", () => {
    const { container } = render(<VoiceDraftReview />);

    expect(screen.getByRole("heading", { name: "Ready for your review" })).toBeInTheDocument();
    const details = container.querySelector(".voice-draft-details");
    expect(details).not.toHaveAttribute("open");

    fireEvent.click(screen.getByText("Edit details"));
    expect(details).toHaveAttribute("open");

    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Petrol delivery" } });
    expect(useVoiceDraftStore.getState().transaction?.description).toBe("Petrol delivery");
  });

  it("discards a staged record without persisting it", () => {
    render(<VoiceDraftReview />);
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));

    expect(useVoiceDraftStore.getState().transaction).toBeNull();
    expect(mocks.createTransaction.mutateAsync).not.toHaveBeenCalled();
  });

  it("saves only after explicit confirmation", async () => {
    render(<VoiceDraftReview />);
    fireEvent.click(screen.getByRole("button", { name: "Save record" }));

    await waitFor(() => expect(mocks.createTransaction.mutateAsync).toHaveBeenCalledTimes(1));
    expect(mocks.createTransaction.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      businessId: "business-1",
      createdBy: "user-1",
      sourceType: "voice",
      status: "confirmed",
      total: 45,
    }));
    expect(await screen.findByText(/Saved record/)).toBeInTheDocument();
  });
});
