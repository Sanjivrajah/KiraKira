import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommercialDocument } from "@/domain";
import { FRONTEND_STORAGE_KEYS } from "@/frontend/storage";
import { render } from "@/test/render";
import { InvoiceBuilder } from "./invoice-builder";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

describe("Session 7 invoice builder", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, "", "/invoices/new");
  });

  it("creates a structured customer and selects it", async () => {
    render(<InvoiceBuilder now="2026-07-15T09:00:00.000Z" />);
    fireEvent.click(screen.getByRole("button", { name: /Create customer/ }));
    fireEvent.change(screen.getByLabelText("Legal name"), { target: { value: "New Buyer Sdn. Bhd." } });
    fireEvent.change(screen.getByLabelText("TIN"), { target: { value: "C2345678901" } });
    fireEvent.change(screen.getByLabelText("Registration value"), { target: { value: "202601234567" } });
    fireEvent.change(screen.getByLabelText("Address line 1"), { target: { value: "10 Jalan Baru" } });
    fireEvent.change(screen.getByLabelText("City"), { target: { value: "Shah Alam" } });
    fireEvent.click(screen.getByRole("button", { name: "Save customer" }));
    await waitFor(() => expect(localStorage.getItem(FRONTEND_STORAGE_KEYS.parties)).toContain("New Buyer Sdn. Bhd."));
    await waitFor(() => expect((screen.getByLabelText("Customer") as HTMLSelectElement).value).toMatch(/^party_/));
    expect(screen.getAllByText("New Buyer Sdn. Bhd.").length).toBeGreaterThan(0);
  });

  it("supports a controlled General Public buyer", () => {
    render(<InvoiceBuilder now="2026-07-15T09:00:00.000Z" />);
    fireEvent.click(screen.getByRole("button", { name: "Use General Public" }));
    expect(screen.getByLabelText("Customer")).toHaveValue("party_general_public");
    expect(screen.getByText(/EI00000000010/)).toBeInTheDocument();
  });

  it("saves a standard invoice to both presentation and canonical storage", async () => {
    render(<InvoiceBuilder now="2026-07-15T09:00:00.000Z" />);
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Consulting service" } });
    fireEvent.change(screen.getByLabelText("Unit price (RM)"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Save document" }));
    await waitFor(() => {
      const documents = JSON.parse(localStorage.getItem(FRONTEND_STORAGE_KEYS.documents) || "[]") as CommercialDocument[];
      expect(documents).toEqual([expect.objectContaining({ documentType: "invoice", buyerPartyId: "customer_kedai_murni" })]);
    });
  });

  it("keeps tax-exempt advanced values when collapsed", () => {
    render(<InvoiceBuilder now="2026-07-15T09:00:00.000Z" />);
    const disclosure = screen.getByText("Tax, classification and adjustments");
    fireEvent.click(disclosure);
    fireEvent.change(screen.getByLabelText("Tax type code"), { target: { value: "E" } });
    fireEvent.change(screen.getByLabelText("Exemption reason"), { target: { value: "Approved exemption" } });
    fireEvent.click(disclosure);
    fireEvent.click(disclosure);
    expect(screen.getByLabelText("Tax type code")).toHaveValue("E");
    expect(screen.getByLabelText("Exemption reason")).toHaveValue("Approved exemption");
  });

  it("navigates from a readiness error to the exact field", () => {
    render(<InvoiceBuilder now="2026-07-15T09:00:00.000Z" />);
    fireEvent.click(screen.getByRole("button", { name: /Item descriptions/ }));
    expect(screen.getByLabelText("Description")).toHaveFocus();
  });

  it("does not claim MyInvois readiness while invoice blockers remain", () => {
    render(<InvoiceBuilder now="2026-07-15T09:00:00.000Z" />);

    expect(screen.getByRole("heading", { name: /MyInvois submission Needs action/ })).toBeInTheDocument();
    expect(screen.getByText("Resolve the bookkeeping and invoice blockers above first.")).toBeInTheDocument();
  });
});
