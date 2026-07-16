import { describe, expect, it } from "vitest";
import { voiceTransactionExtractionSchema } from "./voice-transaction-schema";

describe("voiceTransactionExtractionSchema", () => {
  it("accepts a reviewable voice transaction", () => {
    expect(voiceTransactionExtractionSchema.parse({
      relevant: true,
      type: "expense",
      date: "2026-07-14",
      amount: 50,
      currency: "MYR",
      category: "Inventory",
      description: "Bought cooking oil",
      counterpartyName: "Maju Mart",
      paymentMethod: "Cash",
      evidence: "bought cooking oil for fifty ringgit",
      warnings: [],
    }).amount).toBe(50);
  });

  it("supports an unrelated transcript without inventing values", () => {
    expect(voiceTransactionExtractionSchema.parse({
      relevant: false,
      type: "unknown",
      date: "",
      amount: null,
      currency: "unknown",
      category: "",
      description: "",
      counterpartyName: "",
      paymentMethod: "",
      evidence: "",
      warnings: ["No transaction was described."],
    }).relevant).toBe(false);
  });
});
