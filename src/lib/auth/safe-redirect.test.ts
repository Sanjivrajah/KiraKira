import { describe, expect, it } from "vitest";
import { safeAppPath } from "./safe-redirect";

describe("safeAppPath", () => {
  it("keeps relative application paths and their query strings", () => {
    expect(safeAppPath("/transactions?filter=attention", "/dashboard")).toBe("/transactions?filter=attention");
  });

  it.each(["https://example.com", "//example.com", "/\\example.com", "not-a-path", null])(
    "rejects an unsafe redirect value: %s",
    (value) => {
      expect(safeAppPath(value, "/dashboard")).toBe("/dashboard");
    },
  );
});
