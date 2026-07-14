import { beforeEach, describe, expect, it } from "vitest";
import { deleteInvoiceReminder, getReminders, markInvoiceReminded } from "./storage";

describe("reminder storage", () => {
  beforeEach(() => localStorage.clear());

  it("records and removes reminder history for an invoice", () => {
    expect(markInvoiceReminded(
      { id: "inv_test", businessId: "business_test", customerName: "Kedai Murni", customerEmail: "accounts@example.com" },
      "Friendly reminder",
      "2026-07-14T08:00:00.000Z",
    )).toBe(true);
    expect(getReminders()).toEqual([expect.objectContaining({
      invoiceId: "inv_test",
      businessId: "business_test",
      recipient: "accounts@example.com",
      messagePreview: "Friendly reminder",
      sentAt: "2026-07-14T08:00:00.000Z",
      status: "sent",
    })]);
    expect(deleteInvoiceReminder("inv_test")).toBe(true);
    expect(getReminders()).toEqual([]);
  });
});
