import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = resolve(process.cwd(), "supabase/migrations");
const migrationSql = readdirSync(migrationsDirectory)
  .sort()
  .map((file) => readFileSync(resolve(migrationsDirectory, file), "utf8"))
  .join("\n");
const orchestrationMigrationSql = readFileSync(resolve(migrationsDirectory, "20260716170000_agent_orchestration_foundation.sql"), "utf8");
const msicConstraintMigrationSql = readFileSync(resolve(migrationsDirectory, "20260718070000_fix_business_msic_constraint.sql"), "utf8");
const payloadHashFunctionMigrationSql = readFileSync(resolve(migrationsDirectory, "20260718090000_fix_e_invoice_payload_hash_function.sql"), "utf8");
const myInvoisSecretReferenceMigrationSql = readFileSync(resolve(migrationsDirectory, "20260718100000_normalize_myinvois_secret_references.sql"), "utf8");
const rejectedSubmissionRepairMigrationSql = readFileSync(resolve(migrationsDirectory, "20260718110000_repair_myinvois_rejected_submission_responses.sql"), "utf8");
const laterRejectedSubmissionRepairMigrationSql = readFileSync(resolve(migrationsDirectory, "20260718120000_repair_later_myinvois_rejected_responses.sql"), "utf8");
const invoiceEditingMigrationSql = readFileSync(resolve(migrationsDirectory, "20260718130000_update_party_einvoice_profile.sql"), "utf8");
const supplierEditingMigrationSql = readFileSync(resolve(migrationsDirectory, "20260718140000_update_business_einvoice_profile.sql"), "utf8");

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
      "20260716130000_invoice_lifecycle_payments_and_audit.sql",
      "20260716140000_telegram_agent_durable_workflows.sql",
      "20260716150000_data_import_batches.sql",
      "20260716160000_einvoice_schema_alignment.sql",
      "20260716160100_telegram_worker_crud_permissions.sql",
      "20260716170000_agent_orchestration_foundation.sql",
      "20260717100000_telegram_generic_workflow_state.sql",
      "20260717110000_telegram_link_code_member_issuance.sql",
      "20260717130000_financial_insights_orchestration.sql",
      "20260717140000_telegram_confirmation_category_fallback.sql",
      "20260717150000_telegram_confirmation_source_provenance.sql",
      "20260717160000_profile_display_name_backfill.sql",
      "20260717170000_voice_conversation_history.sql",
      "20260717180000_e_invoice_persistence_and_assembly.sql",
      "20260717210000_e_invoice_preparation_workspace.sql",
      "20260717230000_e_invoice_payload_snapshots.sql",
      "20260718000000_e_invoice_intermediary_auth_and_signing.sql",
      "20260718010000_e_invoice_sandbox_submission_and_status.sql",
      "20260718020000_myinvois_taxpayer_auth_mode.sql",
      "20260718030000_e_invoice_production_operations.sql",
      "20260718040000_e_invoice_v1_0_only.sql",
      "20260718050000_e_invoice_v1_0_document_constraint.sql",
      "20260718060000_business_compliance_profile_update.sql",
      "20260718070000_fix_business_msic_constraint.sql",
      "20260718080000_invoice_prepayment_amount.sql",
      "20260718090000_fix_e_invoice_payload_hash_function.sql",
      "20260718100000_normalize_myinvois_secret_references.sql",
      "20260718110000_repair_myinvois_rejected_submission_responses.sql",
      "20260718120000_repair_later_myinvois_rejected_responses.sql",
      "20260718130000_update_party_einvoice_profile.sql",
      "20260718140000_update_business_einvoice_profile.sql",
    ]);
  });

  it("keeps historical signing schema inaccessible and constrains active records to v1.0", () => {
    expect(migrationSql).toContain("new e-invoice records must use unsigned MyInvois Invoice v1.0");
    expect(migrationSql).toContain("revoke all on public.e_invoice_signed_snapshots from anon, authenticated");
    expect(migrationSql).toContain("comment on table public.e_invoice_signed_snapshots is");
    expect(migrationSql).toMatch(/grant select \(\s*id, business_id, environment, auth_mode/);
    expect(migrationSql).toContain("revoke select, insert, update on public.myinvois_connections from authenticated");
    expect(migrationSql).toMatch(/grant insert \(\s*business_id, environment, auth_mode, taxpayer_tin/);
    expect(migrationSql).toContain("document_version <> '1.0'");
    expect(migrationSql).toContain("alter column document_version set default '1.0'");
    expect(migrationSql).toContain("check (document_version in ('1.0', '1.1'))");
  });

  it("atomically persists editable buyer profiles and required draft metadata", () => {
    expect(invoiceEditingMigrationSql).toContain("function public.update_party_einvoice_profile");
    expect(invoiceEditingMigrationSql).toContain("function public.save_invoice_draft_with_metadata");
    expect(invoiceEditingMigrationSql).toContain("complete customer identity, contact and address fields are required");
    expect(invoiceEditingMigrationSql).toContain("document number and issue time are required");
    expect(invoiceEditingMigrationSql).toContain("grant execute on function public.update_party_einvoice_profile");
    expect(invoiceEditingMigrationSql).toContain("grant execute on function public.save_invoice_draft_with_metadata");
    expect(supplierEditingMigrationSql).toContain("function public.update_business_einvoice_profile");
    expect(supplierEditingMigrationSql).toContain("supplier legal name, TIN and registration are required");
  });

  it("gates v1.0 production activation and leases reconciliation work durably", () => {
    expect(migrationSql).toContain("function public.set_e_invoice_production_activation");
    expect(migrationSql).toContain("function public.claim_due_e_invoice_submissions");
    expect(migrationSql).toContain("for update skip locked");
    expect(migrationSql).toContain("document_version text not null default '1.0'");
    expect(migrationSql).toContain("worker_dead_lettered");
    expect(migrationSql).toContain("function public.record_e_invoice_cancellation");
    expect(migrationSql).toContain("function public.claim_e_invoice_cancellation");
    expect(migrationSql).toContain("function public.reserve_e_invoice_provider_call");
  });

  it("uses secured RPCs for invoice lifecycles, payment allocation, and idempotent reminders", () => {
    expect(migrationSql).toContain("function public.save_invoice_draft");
    expect(migrationSql).toContain("function public.update_invoice_prepayment");
    expect(migrationSql).toContain("prepayment cannot change after e-invoice approval");
    expect(migrationSql).toContain("function public.issue_invoice");
    expect(migrationSql).toContain("function public.record_invoice_payment");
    expect(migrationSql).toContain("function public.reverse_invoice_payment");
    expect(migrationSql).toContain("function public.claim_reminder_delivery");
    expect(migrationSql).toContain("issued invoice financial and buyer snapshots are immutable");
    expect(migrationSql).toContain("revoke all on public.invoice_sequences");
  });

  it("contains all business-owned persistence surfaces without permissive RLS policies", () => {
    for (const table of ["profiles", "businesses", "business_members", "transactions", "evidence_files", "extraction_runs", "invoices", "payment_reminders", "telegram_accounts", "voice_conversations", "voice_conversation_turns", "audit_events"]) {
      expect(migrationSql).toContain(`public.${table}`);
    }
    expect(migrationSql).not.toMatch(/create\s+policy[\s\S]*?using\s*\(\s*true\s*\)/i);
  });

  it("enables RLS and keeps identity, membership, and business creation behind controlled paths", () => {
    expect(migrationSql).toContain("alter table public.transactions enable row level security");
    expect(migrationSql).toContain("alter table public.audit_events enable row level security");
    expect(migrationSql).toContain("function public.handle_new_auth_user()");
    expect(migrationSql).toContain("function public.create_business(");
    expect(migrationSql).toContain("function public.update_business_compliance_profile(");
    expect(migrationSql).toContain("business management permission is required");
    expect(migrationSql).toContain("function public.upsert_business_member(");
    expect(migrationSql).toContain("set search_path = public");
    expect(migrationSql).toContain("cross-business reference is not allowed");
  });

  it("accepts exactly five numeric digits for an MSIC code without regex escape ambiguity", () => {
    expect(msicConstraintMigrationSql).toContain("drop constraint if exists businesses_msic_code_check");
    expect(msicConstraintMigrationSql).toContain("msic_code ~ '^[0-9]{5}$'");
  });

  it("keeps money in integer minor units and uses update timestamp triggers", () => {
    expect(migrationSql).toContain("total_minor bigint");
    expect(migrationSql).toContain("function public.set_updated_at()");
    expect(migrationSql).not.toMatch(/\b(real|double precision)\b/i);
    expect(migrationSql).toContain("constraint invoices_totals_reconcile_check");
  });

  it("separates e-invoice preparation from payment state with tenant and revision guards", () => {
    expect(migrationSql).toContain("create table public.e_invoice_documents");
    expect(migrationSql).toContain("business_tax_identifiers");
    expect(migrationSql).toContain("business_registration_identifiers");
    expect(migrationSql).toContain("status in ('needs_information','ready','approved')");
    expect(migrationSql).toContain("source_invoice_revision");
    expect(migrationSql).toContain("function public.save_e_invoice_supplemental_fields");
    expect(migrationSql).toContain("function public.approve_e_invoice_document");
    expect(migrationSql).toContain("function public.save_invoice_compliance_details");
    expect(migrationSql).toContain("stale or immutable e-invoice preparation revision");
    expect(migrationSql).toContain("approved e-invoice preparation revisions are immutable");
    expect(migrationSql).toContain("function public.create_e_invoice_revision");
    expect(migrationSql).toContain("e_invoice_documents_one_active_source_revision");
    expect(migrationSql).toContain("authoritative internal preparation checks must pass before approval");
  });

  it("stores exact immutable e-invoice payload snapshots behind tenant guards", () => {
    expect(migrationSql).toContain("create table public.e_invoice_payload_snapshots");
    expect(migrationSql).toContain("unsigned_payload text not null");
    expect(migrationSql).toContain("document_version in ('1.0', '1.1')");
    expect(migrationSql).toContain("payload_size_bytes = octet_length(unsigned_payload)");
    expect(migrationSql).toContain("assert_e_invoice_payload_snapshot_source");
    expect(migrationSql).toContain("unsigned payload hash does not match the exact UTF-8 bytes");
    expect(migrationSql).toContain("e_invoice_payload_snapshots_read");
    expect(migrationSql).toContain("e_invoice_payload_snapshots_insert");
    expect(migrationSql).toContain("revoke update, delete, truncate on public.e_invoice_payload_snapshots from anon, authenticated");
    expect(migrationSql).not.toContain("e_invoice_payload_snapshots_update");
  });

  it("resolves the payload hash function from Supabase's extensions schema", () => {
    expect(payloadHashFunctionMigrationSql).toContain("extensions.digest(");
    expect(payloadHashFunctionMigrationSql).toContain("create or replace function public.assert_e_invoice_payload_snapshot_source()");
  });

  it("normalizes legacy MyInvois secret names to scoped opaque references", () => {
    expect(myInvoisSecretReferenceMigrationSql).toContain("'env:' || environment || ':' || client_id_secret_ref");
    expect(myInvoisSecretReferenceMigrationSql).toContain("'env:' || environment || ':' || client_secret_secret_ref");
  });

  it("repairs all-rejected HTTP 202 responses recorded by the strict legacy parser", () => {
    expect(rejectedSubmissionRepairMigrationSql).toContain("submission.raw_response->'rejectedDocuments'");
    expect(rejectedSubmissionRepairMigrationSql).toContain("raw_response->>'submissionUid'");
    expect(rejectedSubmissionRepairMigrationSql).toContain("error_code = 'invalid_response'");
    expect(laterRejectedSubmissionRepairMigrationSql).toContain("rejection_error = rejected.item->'error'");
    expect(laterRejectedSubmissionRepairMigrationSql).toContain("error_code = 'invalid_response'");
  });

  it("keeps MyInvois delegation references tenant-scoped and signed bytes immutable", () => {
    expect(migrationSql).toContain("create table public.myinvois_connections");
    expect(migrationSql).toContain("auth_mode text not null check (auth_mode = 'intermediary')");
    expect(migrationSql).toContain("onbehalfof_value text generated always");
    expect(migrationSql).toContain("create table public.e_invoice_signed_snapshots");
    expect(migrationSql).toContain("assert_e_invoice_signed_snapshot_source");
    expect(migrationSql).toContain("signed payload hash does not match the exact UTF-8 bytes");
    expect(migrationSql).toContain("signed payload must contain the MyInvois UBL signature structures");
    expect(migrationSql).toContain("signed snapshots require the active approved document revision");
    expect(migrationSql).toContain("revoke update, delete, truncate on public.e_invoice_signed_snapshots from anon, authenticated");
    expect(migrationSql).not.toContain("e_invoice_signed_snapshots_update");
    expect(migrationSql).toContain("check (auth_mode in ('taxpayer', 'intermediary'))");
  });

  it("keeps sandbox submission and status history tenant-scoped and append-only", () => {
    expect(migrationSql).toContain("create table public.e_invoice_submissions");
    expect(migrationSql).toContain("create table public.e_invoice_submission_documents");
    expect(migrationSql).toContain("payload_snapshot_id uuid not null references public.e_invoice_payload_snapshots");
    expect(migrationSql).toContain("payload.document_version = '1.0'");
    expect(migrationSql).toContain("create table public.e_invoice_status_events");
    expect(migrationSql).toContain("unique (business_id, idempotency_key)");
    expect(migrationSql).toContain("function public.create_e_invoice_pending_submission");
    expect(migrationSql).toContain("function public.record_e_invoice_submission_response");
    expect(migrationSql).toContain("function public.reconcile_e_invoice_submission");
    expect(migrationSql).toContain("revoke insert, update, delete, truncate on public.e_invoice_submissions");
    expect(migrationSql).not.toContain("e_invoice_submissions_update");
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

  it("keeps Telegram linking, confirmation, and undo behind durable server-side workflows", () => {
    expect(migrationSql).toContain("create table public.telegram_link_codes");
    expect(migrationSql).toContain("function public.consume_telegram_link_code");
    expect(migrationSql).toContain("function public.confirm_telegram_transaction");
    expect(migrationSql).toContain("function public.void_telegram_transaction");
    expect(migrationSql).toContain("draft_id uuid");
    expect(migrationSql).toContain("version integer not null default 0");
    expect(migrationSql).toContain("grant execute on function public.consume_telegram_link_code(text, bigint, bigint, text, boolean) to service_role");
    expect(migrationSql).toContain("grant execute on function public.confirm_telegram_transaction(uuid, uuid, text, jsonb) to service_role");
    expect(migrationSql).toContain("grant execute on function public.void_telegram_transaction(uuid, uuid, text) to service_role");
    expect(migrationSql).toContain("workflow_status text");
    expect(migrationSql).toContain("telegram_conversation_workflow_status_check");
    expect(migrationSql).toContain("telegram_link_codes_member_write");
  });

  it("records explicit import batches behind tenant-scoped RLS", () => {
    expect(migrationSql).toContain("create table public.data_import_batches");
    expect(migrationSql).toContain("alter table public.data_import_batches enable row level security");
    expect(migrationSql).toContain("source_batch_id uuid not null");
    expect(migrationSql).toContain("data_import_batches_insert");
  });

  it("keeps orchestration traces redacted, tenant-scoped, and idempotent", () => {
    expect(orchestrationMigrationSql).toContain("create table public.agent_orchestration_runs");
    expect(orchestrationMigrationSql).toContain("create table public.agent_orchestration_steps");
    expect(orchestrationMigrationSql).toContain("idempotency_key text not null unique");
    expect(orchestrationMigrationSql).toContain("agent_orchestration_runs_active_account_idx");
    expect(orchestrationMigrationSql).toContain("alter table public.agent_orchestration_runs enable row level security");
    expect(orchestrationMigrationSql).not.toContain("raw_text");
  });
});
