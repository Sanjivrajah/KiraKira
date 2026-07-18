import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createTransaction: { isPending: false, mutateAsync: vi.fn() },
  updateTransaction: { isPending: false, mutateAsync: vi.fn() },
  deleteTransaction: { isPending: false, mutateAsync: vi.fn() },
  createInvoice: { isPending: false, mutateAsync: vi.fn() },
  updateInvoice: { isPending: false, mutateAsync: vi.fn() },
  markReminderSent: { isPending: false, mutateAsync: vi.fn() },
  nextInvoiceNumber: vi.fn(async () => "INV-1099"),
  getInvoiceById: vi.fn(async () => null),
}));

vi.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ session: { user: { id: "user-1" } }, mode: "demo" }),
}));
vi.mock("@/hooks/use-business", () => ({
  useBusiness: () => ({ data: { id: "business-1" } }),
}));
vi.mock("@/hooks/use-transactions", () => ({
  useCreateTransaction: () => mocks.createTransaction,
  useUpdateTransaction: () => mocks.updateTransaction,
  useDeleteTransaction: () => mocks.deleteTransaction,
}));
vi.mock("@/hooks/use-invoices", () => ({
  useCreateInvoice: () => mocks.createInvoice,
  useUpdateInvoice: () => mocks.updateInvoice,
}));
vi.mock("@/hooks/use-reminders", () => ({ useMarkReminderSent: () => mocks.markReminderSent }));
vi.mock("@/services", () => ({
  services: { invoices: { nextInvoiceNumber: mocks.nextInvoiceNumber, getById: mocks.getInvoiceById } },
}));

import { VoiceDraftReview } from "./voice-draft-review";
import { useVoiceDraftStore, type VoiceInvoiceDraft, type VoiceTransactionDraft } from "./voice-draft-store";

const transaction: VoiceTransactionDraft = {
  mode: "create",
  editingId: null,
  type: "expense",
  date: "2026-07-17",
  amount: 45,
  taxRate: 0,
  taxInclusive: false,
  quantity: null,
  unit: "",
  category: "Fuel",
  description: "Petrol",
  counterpartyId: null,
  counterpartyName: "Station Murni",
  paymentMethod: "cash",
  notes: "",
  original: null,
};

const invoiceDraft: VoiceInvoiceDraft = {
  customerId: "party_1",
  customerName: "Mei Enterprise",
  customerEmail: "mei@demo.test",
  buyerTin: "EI00000000099",
  issueDate: "2026-07-17",
  dueDate: "2026-07-31",
  paymentTerms: "Payment due within 14 days.",
  prepaymentAmount: 0,
  items: [{ description: "Kraf bag", quantity: 3, unitPrice: 30, taxRate: 6, classificationCode: "022", unitCode: "C62", taxTypeCode: "06", exemptionReason: "", discountAmount: 0, chargeAmount: 0 }],
  notes: null,
};

describe("VoiceDraftReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useVoiceDraftStore.getState().reset();
    useVoiceDraftStore.getState().setTransaction(transaction);
    mocks.createTransaction.mutateAsync.mockResolvedValue({ ...transaction, id: "txn-1", total: 45 });
    mocks.updateTransaction.mutateAsync.mockResolvedValue({ ...transaction, id: "txn-1", total: 50 });
    mocks.createInvoice.mutateAsync.mockResolvedValue({ ...invoiceDraft, id: "inv-1", invoiceNumber: "INV-1099", total: 95.4 });
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

  it("shows the tax split and notes, and persists them on save", async () => {
    useVoiceDraftStore.getState().setTransaction({ ...transaction, amount: 106, taxRate: 6, taxInclusive: true, notes: "For Raya orders" });
    render(<VoiceDraftReview />);
    expect(screen.getByText(/Subtotal/)).toBeInTheDocument();
    expect(screen.getByText(/For Raya orders/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save record" }));
    await waitFor(() => expect(mocks.createTransaction.mutateAsync).toHaveBeenCalledTimes(1));
    expect(mocks.createTransaction.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ subtotal: 100, tax: 6, total: 106, notes: "For Raya orders" }));
  });

  it("uses a sequential invoice number from the service when confirming an invoice", async () => {
    useVoiceDraftStore.getState().reset();
    useVoiceDraftStore.getState().setInvoice(invoiceDraft);
    render(<VoiceDraftReview />);
    fireEvent.click(screen.getByRole("button", { name: "Save draft invoice" }));
    await waitFor(() => expect(mocks.createInvoice.mutateAsync).toHaveBeenCalledTimes(1));
    expect(mocks.nextInvoiceNumber).toHaveBeenCalledWith("business-1");
    expect(mocks.createInvoice.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ invoiceNumber: "INV-1099", buyerTin: "EI00000000099", customerId: "party_1" }));
  });

  it("updates an existing record when confirming an edit", async () => {
    useVoiceDraftStore.getState().reset();
    useVoiceDraftStore.getState().setTransaction({
      ...transaction,
      mode: "edit",
      editingId: "txn-1",
      amount: 50,
      original: { id: "txn-1", businessId: "business-1", createdBy: "user-1", type: "expense", status: "confirmed", sourceType: "voice", date: "2026-07-17", counterpartyName: "Station Murni", description: "Petrol", category: "Fuel", currency: "MYR", subtotal: 45, tax: 0, total: 45, items: [], createdAt: "2026-07-16T00:00:00.000Z", updatedAt: "2026-07-16T00:00:00.000Z" },
    });
    render(<VoiceDraftReview />);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mocks.updateTransaction.mutateAsync).toHaveBeenCalledTimes(1));
    expect(mocks.updateTransaction.mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ id: "txn-1", total: 50, createdAt: "2026-07-16T00:00:00.000Z" }));
    expect(mocks.createTransaction.mutateAsync).not.toHaveBeenCalled();
  });

  it("only deletes a saved record after confirming the destructive card", async () => {
    useVoiceDraftStore.getState().reset();
    useVoiceDraftStore.getState().setPendingDelete({ kind: "transaction", id: "txn-9", label: "RM45 money out for Petrol on 2026-07-16" });
    mocks.deleteTransaction.mutateAsync.mockResolvedValue(undefined);
    render(<VoiceDraftReview />);
    expect(screen.getByRole("heading", { name: "Confirm deletion" })).toBeInTheDocument();
    expect(screen.getByText(/can't be undone/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete record" }));
    await waitFor(() => expect(mocks.deleteTransaction.mutateAsync).toHaveBeenCalledWith({ businessId: "business-1", transactionId: "txn-9" }));
  });
});
