import { NextResponse } from "next/server";
import { z } from "zod";
import { EInvoiceSubmissionService, EInvoiceSubmissionServiceError, GenerateEInvoicePayloadSnapshotService } from "@/application/e-invoices";
import { EnvironmentSecretProvider, MyInvoisIntermediaryOAuthClient, MyInvoisSubmissionTransport } from "@/integrations/myinvois";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { SupabaseEInvoiceRepository, SupabaseEInvoiceSubmissionRepository } from "@/repositories";

export const runtime = "nodejs";

const businessIdSchema = z.string().uuid();
const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("generate_v1_0"), businessId: businessIdSchema, documentId: z.string().uuid() }).strict(),
  z.object({ action: z.literal("preview"), businessId: businessIdSchema, payloadSnapshotIds: z.array(z.string().uuid()).min(1).max(100) }).strict(),
  z.object({ action: z.literal("submit"), businessId: businessIdSchema, payloadSnapshotIds: z.array(z.string().uuid()).min(1).max(100) }).strict(),
  z.object({ action: z.literal("refresh"), businessId: businessIdSchema, submissionId: z.string().uuid() }).strict(),
]);

const secrets = new EnvironmentSecretProvider();
const oauth = new MyInvoisIntermediaryOAuthClient(secrets, {
  identityBaseUrls: {
    sandbox: process.env.MYINVOIS_SANDBOX_IDENTITY_BASE_URL ?? "https://preprod-api.myinvois.hasil.gov.my",
    production: process.env.MYINVOIS_PRODUCTION_IDENTITY_BASE_URL ?? "https://api.myinvois.hasil.gov.my",
  },
});
const transport = new MyInvoisSubmissionTransport(oauth, {
  apiBaseUrls: {
    sandbox: process.env.MYINVOIS_SANDBOX_API_BASE_URL ?? "https://preprod-api.myinvois.hasil.gov.my",
    production: process.env.MYINVOIS_PRODUCTION_API_BASE_URL ?? "https://api.myinvois.hasil.gov.my",
  },
});

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function responseError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

async function member(client: Client, businessId: string) {
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) return null;
  const { data, error } = await client.from("business_members").select("role")
    .eq("business_id", businessId).eq("user_id", auth.user.id).eq("status", "active").maybeSingle();
  return error || !data ? null : { userId: auth.user.id, role: data.role };
}

export async function GET(request: Request) {
  const parsed = businessIdSchema.safeParse(new URL(request.url).searchParams.get("businessId"));
  if (!parsed.success) return responseError("Choose a valid business.", 400);
  const client = await createSupabaseServerClient();
  if (!await member(client, parsed.data)) return responseError("You do not have access to this business.", 403);
  try {
    const repository = new SupabaseEInvoiceSubmissionRepository(client);
    const [candidates, submissions, connection] = await Promise.all([
      repository.listSubmissionCandidates(parsed.data, "sandbox"),
      repository.listSubmissions(parsed.data),
      repository.findConnection(parsed.data, "sandbox"),
    ]);
    return NextResponse.json({
      environment: "sandbox",
      taxpayerIdentity: connection?.onbehalfofValue,
      candidates: candidates.filter((item) => item.approved && item.active && item.submissionEligible).map((item) => ({
        payloadSnapshotId: item.payloadSnapshotId,
        eInvoiceDocumentId: item.eInvoiceDocumentId,
        invoiceCodeNumber: item.invoiceCodeNumber,
        encodedSizeBytes: Buffer.byteLength(Buffer.from(item.unsignedPayload, "utf8").toString("base64"), "utf8"),
        documentVersion: item.documentVersion,
      })),
      submissions,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return responseError("We could not load sandbox submission status.", 500);
  }
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return responseError("Check the sandbox submission request and try again.", 400);
  const client = await createSupabaseServerClient();
  const membership = await member(client, parsed.data.businessId);
  if (!membership) return responseError("You do not have access to this business.", 403);
  if (!['owner', 'admin'].includes(membership.role)) return responseError("Only an owner or admin can submit or refresh MyInvois records.", 403);
  const repository = new SupabaseEInvoiceSubmissionRepository(client);
  const service = new EInvoiceSubmissionService(repository, transport);
  try {
    const result = parsed.data.action === "generate_v1_0"
      ? await new GenerateEInvoicePayloadSnapshotService(new SupabaseEInvoiceRepository(client))
        .generate(parsed.data.businessId, parsed.data.documentId, new Date().toISOString(), "1.0")
      : parsed.data.action === "preview"
      ? await service.preview(parsed.data.businessId, "sandbox", parsed.data.payloadSnapshotIds)
      : parsed.data.action === "submit"
        ? await service.submit(parsed.data.businessId, "sandbox", parsed.data.payloadSnapshotIds, new Date().toISOString())
        : await service.refresh(parsed.data.businessId, parsed.data.submissionId, new Date().toISOString());
    return NextResponse.json({ result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const actionable = error instanceof EInvoiceSubmissionServiceError;
    return responseError(actionable ? error.message : "The sandbox MyInvois operation could not be completed safely.", actionable ? 409 : 502);
  }
}
