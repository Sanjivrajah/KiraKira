import { describe, expect, it } from "vitest";
import { previewBrowserLocalExport } from "./browser-local";

const valid = { id: "legacy-1", businessId: "old-business", createdBy: "old-user", type: "income", status: "confirmed", sourceType: "manual", date: "2026-07-01", category: "sales", description: "Coffee", total: 12.5, subtotal: 12.5, tax: 0, items: [], createdAt: "2026-07-01T00:00:00.000Z" };

describe("browser-local data migration", () => {
  it("maps supported records deterministically and reports malformed records", () => {
    const result = previewBrowserLocalExport({ schemaVersion: 1, exportId: "8e8d632b-32ff-4b77-9540-06b1f0ab72fa", exportedAt: "2026-07-16T00:00:00.000Z", records: [valid, { id: "broken" }] });
    expect(result.records[0]).toMatchObject({ status: "ready", transaction: { legacyId: "legacy-1", totalMinor: 1250, lifecycle: "confirmed" } });
    expect(result.records[1]).toMatchObject({ status: "invalid", legacyId: "broken" });
  });

  it("rejects an unknown export version", () => {
    expect(() => previewBrowserLocalExport({ schemaVersion: 2, exportId: "8e8d632b-32ff-4b77-9540-06b1f0ab72fa", exportedAt: "2026-07-16T00:00:00.000Z", records: [] })).toThrow();
  });
});
