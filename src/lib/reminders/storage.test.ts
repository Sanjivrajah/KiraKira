import { beforeEach, describe, expect, it } from "vitest";
import { deleteInvoiceReminder, getReminders, markInvoiceReminded } from "./storage";

describe("reminder storage", () => {
  beforeEach(() => localStorage.clear());

  it("records and removes reminder history for an invoice", () => {
    expect(markInvoiceReminded("inv_test", "2026-07-14T08:00:00.000Z")).toBe(true);
    expect(getReminders()).toEqual([{ invoiceId: "inv_test", remindedAt: "2026-07-14T08:00:00.000Z" }]);
    expect(deleteInvoiceReminder("inv_test")).toBe(true);
    expect(getReminders()).toEqual([]);
  });
});
