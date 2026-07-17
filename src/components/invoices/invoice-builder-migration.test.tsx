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
    fireEvent.change(screen.getByLabelText("Legal name (required)"), { target: { value: "New Buyer Sdn. Bhd." } });
    fireEvent.change(screen.getByLabelText("TIN (required)"), { target: { value: "C2345678901" } });
    fireEvent.change(screen.getByLabelText("Registration value (required)"), { target: { value: "202601234567" } });
    fireEvent.change(screen.getByLabelText("Phone (required)"), { target: { value: "+60123456789" } });
    fireEvent.change(screen.getByLabelText("Address line 1 (required)"), { target: { value: "10 Jalan Baru" } });
    fireEvent.change(screen.getByLabelText("City (required)"), { target: { value: "Shah Alam" } });
    fireEvent.change(screen.getByLabelText("State (required)"), { target: { value: "10" } });
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
    fireEvent.change(screen.getByLabelText("Description (required)"), { target: { value: "Consulting service" } });
    fireEvent.change(screen.getByLabelText("Unit price (RM) (required)"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Save document" }));
    await waitFor(() => {
      const documents = JSON.parse(localStorage.getItem(FRONTEND_STORAGE_KEYS.documents) || "[]") as CommercialDocument[];
      expect(documents).toEqual([expect.objectContaining({ documentType: "invoice", buyerPartyId: "customer_kedai_murni" })]);
    });
  });

  it("stores a positive prepayment in canonical totals and reduces the amount due", async () => {
    render(<InvoiceBuilder now="2026-07-15T09:00:00.000Z" />);
    fireEvent.change(screen.getByLabelText("Description (required)"), { target: { value: "Consulting service" } });
    fireEvent.change(screen.getByLabelText("Unit price (RM) (required)"), { target: { value: "100" } });
    fireEvent.click(screen.getByText("5 · Payment"));
    fireEvent.change(screen.getByLabelText("Prepayment amount (RM)"), { target: { value: "25" } });
    expect(screen.getByText("Amount due").parentElement).toHaveTextContent("75.00");
    fireEvent.click(screen.getByRole("button", { name: "Save document" }));
    await waitFor(() => {
      const documents = JSON.parse(localStorage.getItem(FRONTEND_STORAGE_KEYS.documents) || "[]") as CommercialDocument[];
      expect(documents[0]?.monetaryTotals).toMatchObject({ prepaidAmount: { amount: "25" }, payableAmount: { amount: "75.00" } });
    });
  });

  it("rejects a prepayment above the invoice total", async () => {
    render(<InvoiceBuilder now="2026-07-15T09:00:00.000Z" />);
    fireEvent.change(screen.getByLabelText("Description (required)"), { target: { value: "Consulting service" } });
    fireEvent.change(screen.getByLabelText("Unit price (RM) (required)"), { target: { value: "100" } });
    fireEvent.click(screen.getByText("5 · Payment"));
    fireEvent.change(screen.getByLabelText("Prepayment amount (RM)"), { target: { value: "101" } });
    fireEvent.click(screen.getByRole("button", { name: "Save document" }));
    expect(await screen.findByText("Prepayment cannot exceed the invoice total.")).toBeInTheDocument();
  });

  it("keeps tax-exempt advanced values when collapsed", () => {
    render(<InvoiceBuilder now="2026-07-15T09:00:00.000Z" />);
    const disclosure = screen.getByText("Required tax and classification fields");
    fireEvent.click(disclosure);
    fireEvent.change(screen.getByLabelText("Tax type code (required)"), { target: { value: "E" } });
    fireEvent.change(screen.getByLabelText("Exemption reason"), { target: { value: "Approved exemption" } });
    fireEvent.click(disclosure);
    fireEvent.click(disclosure);
    expect(screen.getByLabelText("Tax type code (required)")).toHaveValue("E");
    expect(screen.getByLabelText("Exemption reason")).toHaveValue("Approved exemption");
  });

  it("navigates from a Niaga check to the exact field", () => {
    render(<InvoiceBuilder now="2026-07-15T09:00:00.000Z" />);
    fireEvent.change(screen.getByLabelText("Description (required)"), { target: { value: "Consulting service" } });
    fireEvent.change(screen.getByLabelText("Classification code (required)"), { target: { value: "999" } });
    fireEvent.click(screen.getByRole("button", { name: "Choose classification" }));
    expect(screen.getByLabelText("Classification code (required)")).toHaveFocus();
  });

  it("separates internal preparation checks from official MyInvois status", () => {
    render(<InvoiceBuilder now="2026-07-15T09:00:00.000Z" />);
    fireEvent.change(screen.getByLabelText("Description (required)"), { target: { value: "Consulting service" } });

    expect(screen.getAllByText("MyInvois status").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Not submitted").length).toBeGreaterThan(0);
    expect(screen.getByText(/internal preparation checks, not official MyInvois validation/)).toBeInTheDocument();
    expect(screen.getAllByText("Niaga check").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Reference: MyInvois/).length).toBeGreaterThan(0);
  });

  it("offers an exact customer fix when a buyer TIN is missing", () => {
    render(<InvoiceBuilder now="2026-07-15T09:00:00.000Z" />);
    fireEvent.change(screen.getByLabelText("Description (required)"), { target: { value: "Catering service" } });
    fireEvent.change(screen.getByLabelText("Customer"), { target: { value: "customer_suria_events" } });

    expect(screen.getByText("Buyer TIN is required for this scenario.")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Check customer" })[0]);
    expect(screen.getByLabelText("Customer")).toHaveFocus();
  });
});
