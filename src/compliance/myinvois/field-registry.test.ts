import { describe, expect, it } from "vitest";
import { INVOICE_V1_0_ANNEXURE_FIELDS, INVOICE_V1_0_FIELD_REGISTRY, INVOICE_V1_0_GUIDELINE_FIELDS, INVOICE_V1_0_SCENARIO_OVERLAYS, INVOICE_V1_0_SDK_EXPANSIONS } from "./field-registry";

describe("Invoice v1.0 field registry", () => {
  it("represents every numbered guideline field exactly once", () => {
    expect(INVOICE_V1_0_GUIDELINE_FIELDS.map((field) => field.guidelineNumber).sort((a, b) => (a ?? 0) - (b ?? 0)))
      .toEqual(Array.from({ length: 55 }, (_, index) => index + 1));
  });

  it("represents SDK expansions and every enabled annexure field", () => {
    expect(INVOICE_V1_0_SDK_EXPANSIONS.length).toBeGreaterThanOrEqual(31);
    expect(INVOICE_V1_0_ANNEXURE_FIELDS).toHaveLength(12);
  });

  it("keeps typed keys unique with provenance and persistence metadata", () => {
    expect(new Set(INVOICE_V1_0_FIELD_REGISTRY.map((field) => field.key)).size).toBe(INVOICE_V1_0_FIELD_REGISTRY.length);
    for (const field of INVOICE_V1_0_FIELD_REGISTRY) {
      expect(field.canonicalPath).not.toBe("");
      expect(field.ublPath).not.toBe("");
      expect(field.persistenceLocation).not.toBe("");
      expect(field.sourceVersion).toContain("Invoice 1.0");
      expect(field.verifiedAt).toBe("2026-07-17");
    }
  });

  it("defines every supported scenario without embedding invented placeholder values", () => {
    expect(INVOICE_V1_0_SCENARIO_OVERLAYS.map((overlay) => overlay.key)).toEqual([
      "b2b_invoice", "consolidated_transaction", "foreign_buyer", "self_billed_invoice",
      "credit_note", "debit_note", "refund_note", "tax_exempt", "foreign_currency",
      "import_export", "shipping_recipient",
    ]);
    expect(INVOICE_V1_0_SCENARIO_OVERLAYS.every((overlay) => overlay.placeholderPolicy === "official_rules_only")).toBe(true);
  });
});
