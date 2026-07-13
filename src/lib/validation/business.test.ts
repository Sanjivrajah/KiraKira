import { describe, expect, it } from "vitest";
import { businessSchema } from "./business";

describe("business validation", () => {
  it("normalizes whitespace and accepts optional identifiers", () => {
    const business = businessSchema.parse({
      name: "  Warung   Kak Lina ",
      type: "food_beverage",
      registrationNumber: " ",
      tin: " ",
      currency: "MYR",
      preferredLanguage: "ms",
    });
    expect(business).toMatchObject({ name: "Warung Kak Lina", registrationNumber: "", tin: "" });
  });

  it("rejects unsupported enum values", () => {
    expect(
      businessSchema.safeParse({
        name: "Shop",
        type: "unsupported",
        registrationNumber: "",
        tin: "",
        currency: "MYR",
        preferredLanguage: "fr",
      }).success,
    ).toBe(false);
  });
});
