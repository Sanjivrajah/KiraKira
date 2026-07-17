import { describe, expect, it } from "vitest";
import { primaryNavigation } from "./navigation";

describe("primary navigation", () => {
  it("includes the dashboard as the home destination", () => {
    expect(primaryNavigation.map(({ label, href }) => ({ label, href }))).toEqual([
      { label: "Dashboard", href: "/dashboard" },
      { label: "Records", href: "/transactions" },
      { label: "Voice assistant", href: "/voice" },
      { label: "e-Invoice preparation", href: "/invoices" },
      { label: "Business details", href: "/settings" },
    ]);
  });
});
