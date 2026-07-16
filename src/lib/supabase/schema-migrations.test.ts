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
      "20260716100000_rls_auth_and_membership.sql",
      "20260716110000_storage_and_evidence_security.sql",
      "20260716120000_web_transaction_audit.sql",
    ]);
  });

  it("contains all business-owned persistence surfaces without permissive RLS policies", () => {
    for (const table of ["profiles", "businesses", "business_members", "transactions", "evidence_files", "extraction_runs", "invoices", "payment_reminders", "telegram_accounts", "audit_events"]) {
      expect(migrationSql).toContain(`public.${table}`);
    }
    expect(migrationSql).not.toMatch(/create\s+policy[\s\S]*?using\s*\(\s*true\s*\)/i);
  });

  it("enables RLS and keeps identity, membership, and business creation behind controlled paths", () => {
    expect(migrationSql).toContain("alter table public.transactions enable row level security");
    expect(migrationSql).toContain("alter table public.audit_events enable row level security");
    expect(migrationSql).toContain("function public.handle_new_auth_user()");
    expect(migrationSql).toContain("function public.create_business(");
    expect(migrationSql).toContain("function public.upsert_business_member(");
    expect(migrationSql).toContain("set search_path = public");
    expect(migrationSql).toContain("cross-business reference is not allowed");
  });

  it("keeps money in integer minor units and uses update timestamp triggers", () => {
    expect(migrationSql).toContain("total_minor bigint");
    expect(migrationSql).toContain("function public.set_updated_at()");
    expect(migrationSql).not.toMatch(/\b(real|double precision)\b/i);
  });

  it("keeps evidence buckets private and storage paths business-scoped", () => {
    expect(migrationSql).toContain("'transaction-evidence'");
    expect(migrationSql).toContain("'invoice-documents'");
    expect(migrationSql).toContain("public, file_size_limit");
    expect(migrationSql).toContain("function public.can_upload_evidence_object");
    expect(migrationSql).toContain("function public.can_delete_evidence_object");
    expect(migrationSql).toContain("storage_object_has_business_path");
    expect(migrationSql).toContain("storage_object_bucket_matches_entity");
    expect(migrationSql).not.toMatch(/create\s+policy\s+evidence_object_[\s\S]*?using\s*\(\s*true\s*\)/i);
  });
});
