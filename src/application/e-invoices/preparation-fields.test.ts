import { describe, expect, it } from "vitest";
import { PREPARATION_FIELD_REGISTRY, preparationSupplementalSchema } from "./preparation-fields";

describe("e-Invoice preparation field registry", () => {
  it("traces every editable field to the Stage 1 matrix with stable document-only metadata", () => {
    expect(new Set(PREPARATION_FIELD_REGISTRY.map((field) => field.key)).size).toBe(PREPARATION_FIELD_REGISTRY.length);
    expect(PREPARATION_FIELD_REGISTRY.every((field) => field.registry.key === field.registryKey)).toBe(true);
    expect(PREPARATION_FIELD_REGISTRY.every((field) => field.scope === "document" && field.documentOnly && !field.reusable)).toBe(true);
  });

  it("shows conditional trade and currency fields only for applicable scenarios", () => {
    const exchangeRate = PREPARATION_FIELD_REGISTRY.find((field) => field.key === "exchangeRate");
    const customs = PREPARATION_FIELD_REGISTRY.find((field) => field.key === "customsFormReference");
    expect(exchangeRate?.appliesWhen("foreign_currency")).toBe(true);
    expect(exchangeRate?.appliesWhen("b2b_invoice")).toBe(false);
    expect(customs?.appliesWhen("import_export")).toBe(true);
    expect(customs?.appliesWhen("b2b_invoice")).toBe(false);
  });

  it("rejects incomplete billing periods and invalid exchange rates", () => {
    expect(preparationSupplementalSchema.safeParse({ billingPeriodStart: "2026-07-01" }).success).toBe(false);
    expect(preparationSupplementalSchema.safeParse({ exchangeRate: "0" }).success).toBe(false);
    expect(preparationSupplementalSchema.safeParse({ billingPeriodStart: "2026-07-01", billingPeriodEnd: "2026-07-31" }).success).toBe(true);
  });
});

