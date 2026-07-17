import { NextResponse } from "next/server";
import { EInvoiceSubmissionService } from "@/application/e-invoices";
import { EnvironmentSecretProvider, MyInvoisOAuthClient, MyInvoisSubmissionTransport } from "@/integrations/myinvois";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SupabaseEInvoiceSubmissionRepository } from "@/repositories";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const configured = process.env.EINVOICE_STATUS_SYNC_SECRET?.trim();
  const supplied = request.headers.get("authorization");
  if (!configured || supplied !== `Bearer ${configured}`) return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  const repository = new SupabaseEInvoiceSubmissionRepository(createSupabaseAdminClient());
  const secrets = new EnvironmentSecretProvider();
  const oauth = new MyInvoisOAuthClient(secrets);
  const service = new EInvoiceSubmissionService(repository, new MyInvoisSubmissionTransport(oauth));
  const results = await service.runDue(new Date().toISOString());
  return NextResponse.json({ processed: results.length }, { headers: { "Cache-Control": "no-store" } });
}
