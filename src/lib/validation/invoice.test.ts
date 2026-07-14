import { describe, expect, it } from "vitest";
import { invoiceFormSchema } from "./invoice";

const valid = {
  invoiceNumber: "INV-1025", customerName: "Kedai Murni", customerEmail: "accounts@example.com", buyerTin: "EI123",
  issueDate: "2026-07-14", dueDate: "2026-07-28", status: "draft",
  items: [{ id: "item_1", description: "Catering", quantity: "2", unitPrice: "125.50", taxRate: "8" }],
  notes: "Thank you", paymentTerms: "14 days",
};

describe("invoiceFormSchema", () => {
  it("coerces numeric line-item fields", () => {
    const parsed = invoiceFormSchema.parse(valid);
    expect(parsed.items[0]).toMatchObject({ quantity: 2, unitPrice: 125.5, taxRate: 8 });
  });

  it("rejects invalid dates, email, and line items", () => {
    const result = invoiceFormSchema.safeParse({ ...valid, customerEmail: "bad", dueDate: "2026-07-01", items: [{ ...valid.items[0], description: "", quantity: 0 }] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join("."))).toEqual(expect.arrayContaining(["customerEmail", "dueDate", "items.0.description", "items.0.quantity"]));
    }
  });
});
