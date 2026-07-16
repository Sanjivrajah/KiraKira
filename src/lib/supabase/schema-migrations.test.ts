import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = resolve(process.cwd(), "supabase/migrations");
const migrationSql = readdirSync(migrationsDirectory)
  .sort()
  .map((file) => readFileSync(resolve(migrationsDirectory, file), "utf8"))
  .join("\n");

describe("Supabase schema migrations", () => {
  it("uses ordered timestamped migrations for every Session 2 schema area", () => {
    expect(readdirSync(migrationsDirectory).sort()).toEqual([
      "20260716090000_extensions_and_helpers.sql",
      "20260716090100_identity_and_businesses.sql",
      "20260716090200_parties_and_catalog.sql",
      "20260716090300_transactions_and_evidence.sql",
      "20260716090400_invoices_and_reminders.sql",
      "20260716090500_telegram_integrations.sql",
      "20260716090600_audit_and_idempotency.sql",
    ]);
  });

  it("contains all business-owned persistence surfaces without permissive RLS policies", () => {
    for (const table of ["profiles", "businesses", "business_members", "transactions", "evidence_files", "extraction_runs", "invoices", "payment_reminders", "telegram_accounts", "audit_events"]) {
      expect(migrationSql).toContain(`public.${table}`);
    }
    expect(migrationSql).not.toMatch(/create\s+policy[\s\S]*?using\s*\(\s*true\s*\)/i);
  });

  it("keeps money in integer minor units and uses update timestamp triggers", () => {
    expect(migrationSql).toContain("total_minor bigint");
    expect(migrationSql).toContain("function public.set_updated_at()");
    expect(migrationSql).not.toMatch(/\b(real|double precision)\b/i);
  });
});
