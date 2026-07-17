import { describe, expect, it } from "vitest";
import { describePath, resolveDestination } from "./voice-navigation";

describe("resolveDestination", () => {
  it("resolves canonical destinations to their route", () => {
    expect(resolveDestination("dashboard")?.href).toBe("/dashboard");
    expect(resolveDestination("records")?.href).toBe("/transactions");
    expect(resolveDestination("invoices")?.href).toBe("/invoices");
  });

  it("maps e-invoices to the real /e-invoices route, not /invoices", () => {
    expect(resolveDestination("e-invoices")?.href).toBe("/e-invoices");
    expect(resolveDestination("einvoice")?.href).toBe("/e-invoices");
    expect(resolveDestination("myinvois")?.href).toBe("/e-invoices");
  });

  it("covers the previously-missing routes", () => {
    expect(resolveDestination("cash flow")?.href).toBe("/cash-flow");
    expect(resolveDestination("loan readiness")?.href).toBe("/loan-readiness");
    expect(resolveDestination("new invoice")?.href).toBe("/invoices/new");
    expect(resolveDestination("add expense")?.href).toBe("/transactions/new");
    expect(resolveDestination("inventory")?.href).toBe("/inventory");
  });

  it("is forgiving of casing and punctuation", () => {
    expect(resolveDestination("  E-Invoice ")?.href).toBe("/e-invoices");
    expect(resolveDestination("Cash-Flow")?.href).toBe("/cash-flow");
  });

  it("deep-links e-invoice stages and views", () => {
    expect(resolveDestination("e-invoices", { tab: "submission" })?.href).toBe("/e-invoices?stage=submit");
    expect(resolveDestination("e-invoices", { tab: "prepare", view: "ready" })?.href).toBe(
      "/e-invoices?stage=prepare&view=ready",
    );
    expect(resolveDestination("e-invoices", { view: "blockers" })?.href).toBe(
      "/e-invoices?view=needs_information",
    );
  });

  it("deep-links settings sections", () => {
    expect(resolveDestination("settings", { section: "business profile" })?.href).toBe(
      "/settings?section=business-profile",
    );
    expect(resolveDestination("business", { section: "myinvois" })?.href).toBe(
      "/settings?section=myinvois-connection",
    );
  });

  it("ignores tab/section options on routes that don't support them", () => {
    expect(resolveDestination("dashboard", { tab: "submit", section: "business" })?.href).toBe("/dashboard");
  });

  it("returns null for unknown destinations", () => {
    expect(resolveDestination("teleport")).toBeNull();
    expect(resolveDestination("")).toBeNull();
  });
});

describe("describePath", () => {
  it("names known routes", () => {
    expect(describePath("/dashboard")).toBe("dashboard");
    expect(describePath("/e-invoices")).toBe("e-invoices");
    expect(describePath("/transactions/new")).toBe("new expense");
  });

  it("matches nested detail routes to their parent", () => {
    expect(describePath("/invoices/abc123")).toBe("invoices");
  });

  it("falls back for unknown paths", () => {
    expect(describePath("/nowhere")).toBe("the app");
  });
});
