import { describe, expect, it } from "vitest";
import { formatDashboardDate } from "./date";
import { formatMoney } from "./money";

describe("shared formatters", () => {
  it("formats an injected dashboard date in Malaysia time", () => {
    expect(formatDashboardDate("2026-07-14T23:30:00.000Z")).toBe("Wednesday, 15 July");
  });

  it("formats MYR consistently, including negative amounts", () => {
    expect(formatMoney(1234.5)).toMatch(/RM\s?1,234\.50/);
    expect(formatMoney(-20)).toMatch(/-RM\s?20\.00|RM\s?-20\.00/);
    expect(formatMoney(Number.NaN)).toBe("Amount unavailable");
  });
});
