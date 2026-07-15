import { describe, expect, it } from "vitest";
import { primaryNavigation } from "./navigation";

describe("judged navigation", () => {
  it("keeps the evidence workflow focused on four destinations", () => {
    expect(primaryNavigation.map(({ label, href }) => ({ label, href }))).toEqual([
      { label: "Evidence inbox", href: "/dashboard" },
      { label: "Records", href: "/transactions" },
      { label: "e-Invoice preparation", href: "/invoices" },
      { label: "Business details", href: "/settings" },
    ]);
  });
});
