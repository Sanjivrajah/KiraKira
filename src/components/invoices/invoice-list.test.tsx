import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { repositories } from "@/repositories";
import { InvoiceList } from "./invoice-list";

describe("InvoiceList", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, "", "/invoices");
  });

  it("links seeded invoices to their detail routes", async () => {
    render(<InvoiceList />);
    const links = await screen.findAllByRole("link", { name: "View INV-1024" });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute("href", "/invoices/inv_1024");
  });

  it("updates invoice status in browser storage", async () => {
    render(<InvoiceList />);
    fireEvent.change((await screen.findAllByLabelText("Status for INV-1022"))[0], { target: { value: "sent" } });
    await waitFor(async () => expect((await repositories.invoices.getById({ businessId: "business_demo", invoiceId: "inv_1022" }))?.status).toBe("sent"));
    expect(await screen.findByRole("status")).toHaveTextContent("marked as sent");
  });

  it("shows deletion feedback after returning from a detail page", async () => {
    window.history.replaceState(null, "", "/invoices?deleted=1");
    render(<InvoiceList initialMessage="Invoice deleted successfully." />);
    expect(await screen.findByRole("status")).toHaveTextContent("Invoice deleted successfully");
    expect(window.location.pathname).toBe("/invoices");
  });
});
