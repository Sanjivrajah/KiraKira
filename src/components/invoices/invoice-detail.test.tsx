import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Invoice } from "@/types";
import { InvoiceDetail } from "./invoice-detail";

const mutateAsync = vi.fn();

const invoice: Invoice = {
  id: "2f028c85-6917-44ac-88a6-264a8d240d53",
  businessId: "business-1",
  invoiceNumber: "INV-100",
  customerName: "Buyer Sdn Bhd",
  issueDate: "2026-07-17",
  dueDate: "2026-08-17",
  status: "sent",
  currency: "MYR",
  items: [{ id: "line-1", description: "Catering", quantity: 1, unitPrice: 100, taxRate: 0 }],
  subtotal: 100,
  tax: 0,
  total: 100,
  prepaymentAmount: 0,
  amountPaid: 0,
  createdAt: "2026-07-17T10:00:00.000Z",
  updatedAt: "2026-07-17T10:00:00.000Z",
};
let currentInvoice = invoice;

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/auth/auth-provider", () => ({ useAuth: () => ({ mode: "supabase" }) }));
vi.mock("@/hooks/use-business", () => ({ useBusiness: () => ({ data: { id: "business-1", name: "Niaga Satu", registrationNumber: null, tin: null } }) }));
vi.mock("@/hooks/use-invoices", () => ({
  useInvoice: () => ({ data: currentInvoice, isPending: false, isError: false, refetch: vi.fn() }),
  useUpdateInvoice: () => ({ mutateAsync, isPending: false }),
  useDeleteInvoice: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

beforeEach(() => {
  currentInvoice = invoice;
  mutateAsync.mockReset().mockResolvedValue({ ...invoice, prepaymentAmount: 25 });
});

describe("InvoiceDetail prepayment", () => {
  it("links draft invoices to the complete editor", () => {
    currentInvoice = { ...invoice, status: "draft" };
    render(<InvoiceDetail id={invoice.id} />);
    expect(screen.getByRole("link", { name: "Continue editing" }))
      .toHaveAttribute("href", `/invoices/${invoice.id}/edit`);
  });

  it("does not duplicate the prepayment field on editable drafts", () => {
    currentInvoice = { ...invoice, status: "draft" };
    render(<InvoiceDetail id={invoice.id} />);
    expect(screen.queryByLabelText("Prepayment amount (RM)")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save prepayment" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Update status")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue editing" })).toHaveAttribute("href", `/invoices/${invoice.id}/edit`);
  });

  it("allows a prepayment to be added to an existing sent source invoice", async () => {
    render(<InvoiceDetail id={invoice.id} />);
    fireEvent.change(screen.getByLabelText("Prepayment amount (RM)"), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: "Save prepayment" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      id: invoice.id,
      status: "sent",
      prepaymentAmount: 25,
    })));
    expect(await screen.findByRole("status")).toHaveTextContent("Prepayment of RM 25.00 saved");
  });

  it("rejects an amount above the source invoice total before persistence", async () => {
    render(<InvoiceDetail id={invoice.id} />);
    fireEvent.change(screen.getByLabelText("Prepayment amount (RM)"), { target: { value: "101" } });
    fireEvent.click(screen.getByRole("button", { name: "Save prepayment" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Prepayment cannot exceed the invoice total");
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
