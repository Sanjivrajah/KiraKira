import { describe, expect, it } from "vitest";
import { isoDateSchema } from "@/domain";
import { createMyInvoisReferenceCatalog } from "./code-set";
import { MYINVOIS_PINNED_REFERENCE_DATA } from "./fixtures";
import { MALAYSIA_STATE_OPTIONS, normalizeMalaysiaStateCode } from "./malaysia-states";

describe("pinned MyInvois reference data", () => {
  it("contains every required official code set with unique entries and source metadata", () => {
    expect(MYINVOIS_PINNED_REFERENCE_DATA.version).toBe("myinvois-sdk-2026-07-17");
    expect(MYINVOIS_PINNED_REFERENCE_DATA.entries.length).toBeGreaterThan(3_800);
    expect(MYINVOIS_PINNED_REFERENCE_DATA.sourceUrls).toHaveLength(9);
    expect(MYINVOIS_PINNED_REFERENCE_DATA.sourceUrls.every((url) => url.startsWith("https://sdk.myinvois.hasil.gov.my/files/"))).toBe(true);
    const keys = MYINVOIS_PINNED_REFERENCE_DATA.entries.map((entry) => `${entry.codeSet}:${entry.code}`);
    expect(new Set(keys).size).toBe(keys.length);

    const catalog = createMyInvoisReferenceCatalog(MYINVOIS_PINNED_REFERENCE_DATA.entries, {
      ...MYINVOIS_PINNED_REFERENCE_DATA,
      retrievedAt: isoDateSchema.parse(MYINVOIS_PINNED_REFERENCE_DATA.retrievedAt),
    });
    expect(() => catalog.assertUsable([
      "classification", "country", "currency", "invoice_type", "msic",
      "payment_mode", "state", "tax_type", "unit_of_measurement",
    ], isoDateSchema.parse("2026-07-17"))).not.toThrow();
    expect(catalog.isActive("tax_type", "02", isoDateSchema.parse("2026-07-17"))).toBe(true);
    for (const option of MALAYSIA_STATE_OPTIONS) {
      expect(catalog.find("state", option.value)).toEqual(expect.objectContaining({ description: option.label }));
    }
    expect(normalizeMalaysiaStateCode("Selangor")).toBe("10");
    expect(normalizeMalaysiaStateCode("10")).toBe("10");
    expect(normalizeMalaysiaStateCode("Unknown state")).toBe("Unknown state");
  });
});
