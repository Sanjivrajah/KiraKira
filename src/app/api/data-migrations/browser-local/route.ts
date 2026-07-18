import { NextResponse } from "next/server";
import { z } from "zod";
import { previewBrowserLocalExport } from "@/lib/data-migration/browser-local";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import type { Database, Json } from "@/lib/supabase/database.types";

const requestSchema = z.object({
  mode: z.enum(["preview", "commit"]),
  businessId: z.string().uuid(),
  export: z.unknown(),
}).strict();

type SupabaseError = { code?: string; message: string };
function failure(message: string, status: number) { return NextResponse.json({ error: message }, { status }); }

/** An opt-in endpoint. It never reads browser storage and does not run during page load. */
export async function POST(request: Request) {
  let body: z.infer<typeof requestSchema>;
  try { body = requestSchema.parse(await request.json()); }
  catch { return failure("The import request is invalid.", 400); }

  let preview: ReturnType<typeof previewBrowserLocalExport>;
  try { preview = previewBrowserLocalExport(body.export); }
  catch { return failure("The export file is invalid or uses an unsupported schema version.", 400); }

  const client = await createSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  const user = auth.user;
  if (!user) return failure("Sign in before importing data.", 401);

  const { data: membership, error: membershipError } = await client
    .from("business_members")
    .select("business_id")
    .eq("business_id", body.businessId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .in("role", ["owner", "admin", "accountant", "staff"])
    .maybeSingle();
  if (membershipError || !membership) return failure("You do not have permission to import into this business.", 403);

  const ready = preview.records.filter((record) => record.status === "ready" && record.transaction);
  const errors = preview.records.filter((record) => record.status === "invalid").map(({ index, legacyId, error }) => ({ index, legacyId, error }));
  const externalKeys = ready.map(({ transaction }) => `browser-import:${preview.exportData.exportId}:${transaction!.legacyId}`);
  const { data: existing, error: existingError } = externalKeys.length
    ? await client.from("transactions").select("external_key").eq("business_id", body.businessId).in("external_key", externalKeys)
    : { data: [], error: null };
  if (existingError) return failure("Could not check the target business for duplicate records.", 500);
  const existingKeys = new Set((existing ?? []).map((row) => row.external_key));
  const pending = ready.filter(({ transaction }) => !existingKeys.has(`browser-import:${preview.exportData.exportId}:${transaction!.legacyId}`));

  const report = { batchId: preview.exportData.exportId, source: "browser_local", total: preview.records.length, ready: ready.length, wouldImport: pending.length, skippedDuplicates: ready.length - pending.length, errors };
  if (body.mode === "preview") return NextResponse.json({ mode: "preview", report });

  const { error: batchError } = await client.from("data_import_batches").upsert({
    business_id: body.businessId, source_kind: "browser_local", source_batch_id: preview.exportData.exportId, status: "running", requested_by: user.id, summary: report,
  }, { onConflict: "business_id,source_kind,source_batch_id" });
  if (batchError) return failure("Could not start the import batch.", 500);

  const rows: Database["public"]["Tables"]["transactions"]["Insert"][] = pending.map(({ transaction }) => {
    const item = transaction!;
    const confirmed = item.lifecycle === "confirmed";
    const voided = item.lifecycle === "voided";
    return {
      business_id: body.businessId, direction: item.direction, transaction_type: item.direction === "income" ? "income" : "expense", lifecycle: item.lifecycle,
      occurred_at: item.occurredAt, transaction_date: item.transactionDate, accounting_date: item.transactionDate,
      description: item.description, category_code: item.categoryCode, currency: item.currency,
      subtotal_minor: item.subtotalMinor, tax_minor: item.taxMinor, total_minor: item.totalMinor,
      payment_status: "unknown", payment_method_code: item.paymentMethodCode, e_invoice_treatment: "undetermined", source_provenance: item.sourceProvenance,
      external_key: `browser-import:${preview.exportData.exportId}:${item.legacyId}`, confidence_score: item.confidenceScore,
      confirmed_at: confirmed ? item.occurredAt : null, confirmed_by: confirmed ? user.id : null,
      voided_at: voided ? item.occurredAt : null, voided_by: voided ? user.id : null, void_reason: voided ? "Imported legacy failed record" : null,
      confirmation: item.confirmation as Json, source_links: [], lines: [], totals: {}, created_at: item.occurredAt, updated_at: item.occurredAt, created_by: user.id, updated_by: user.id,
    };
  });
  const { error: insertError } = rows.length ? await client.from("transactions").insert(rows) : { error: null };
  const completeReport = { ...report, imported: rows.length, status: insertError ? "completed_with_errors" : errors.length ? "completed_with_errors" : "completed", databaseError: insertError ? (insertError as SupabaseError).message : undefined };
  await client.from("data_import_batches").update({ status: completeReport.status, summary: completeReport, completed_at: new Date().toISOString() }).eq("business_id", body.businessId).eq("source_kind", "browser_local").eq("source_batch_id", preview.exportData.exportId);
  if (insertError) return NextResponse.json({ mode: "commit", report: completeReport }, { status: 409 });
  return NextResponse.json({ mode: "commit", report: completeReport });
}
