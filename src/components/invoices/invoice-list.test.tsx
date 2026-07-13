import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { getInvoices } from "@/lib/invoices/storage";
import { InvoiceList } from "./invoice-list";

describe("InvoiceList", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, "", "/invoices");
  });

  it("links seeded invoices to their detail routes", () => {
    render(<InvoiceList />);
    const links = screen.getAllByRole("link", { name: "View INV-1024" });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute("href", "/invoices/inv_1024");
  });

  it("updates invoice status in browser storage", () => {
    render(<InvoiceList />);
    fireEvent.change(screen.getAllByLabelText("Status for INV-1022")[0], { target: { value: "sent" } });
    expect(getInvoices().find((invoice) => invoice.id === "inv_1022")?.status).toBe("sent");
    expect(screen.getByRole("status")).toHaveTextContent("marked as sent");
  });

  it("shows deletion feedback after returning from a detail page", async () => {
    window.history.replaceState(null, "", "/invoices?deleted=1");
    render(<InvoiceList initialMessage="Invoice deleted successfully." />);
    expect(await screen.findByRole("status")).toHaveTextContent("Invoice deleted successfully");
    expect(window.location.pathname).toBe("/invoices");
  });
});
