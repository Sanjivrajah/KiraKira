import { describe, expect, it } from "vitest";
import { transactionFormSchema } from "./transaction";

const valid = {
  type: "expense",
  date: "2026-07-14",
  amount: "240.00",
  category: "Inventory",
  description: "20 boxes of mineral water",
  counterpartyName: "ABC Supplier",
  paymentMethod: "Bank Transfer",
  source: "voice",
};

describe("transactionFormSchema", () => {
  it("coerces a valid MYR amount", () => {
    expect(transactionFormSchema.parse(valid).amount).toBe(240);
  });

  it("rejects missing required details and non-positive amounts", () => {
    const result = transactionFormSchema.safeParse({ ...valid, amount: 0, category: "", description: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((issue) => issue.path[0]);
      expect(fields).toEqual(expect.arrayContaining(["amount", "category", "description"]));
    }
  });
});
