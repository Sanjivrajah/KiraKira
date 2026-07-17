import { NextResponse } from "next/server";
import { z } from "zod";
import {
  EInvoicePayloadGenerationError,
  EInvoiceSubmissionService,
  EInvoiceSubmissionServiceError,
  GenerateEInvoicePayloadSnapshotService,
} from "@/application/e-invoices";
import { EnvironmentSecretProvider, MyInvoisOAuthClient, MyInvoisSubmissionTransport } from "@/integrations/myinvois";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { SupabaseEInvoiceRepository, SupabaseEInvoiceSubmissionRepository } from "@/repositories";

export const runtime = "nodejs";

const businessIdSchema = z.string().uuid();
const environmentSchema = z.enum(["sandbox", "production"]);
const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("generate_v1_0"), businessId: businessIdSchema, documentId: z.string().uuid() }).strict(),
  z.object({ action: z.literal("preview"), businessId: businessIdSchema, environment: environmentSchema, payloadSnapshotIds: z.array(z.string().uuid()).min(1).max(100) }).strict(),
  z.object({ action: z.literal("submit"), businessId: businessIdSchema, environment: environmentSchema, confirmation: z.string().optional(), payloadSnapshotIds: z.array(z.string().uuid()).min(1).max(100) }).strict(),
  z.object({ action: z.literal("refresh"), businessId: businessIdSchema, submissionId: z.string().uuid() }).strict(),
  z.object({ action: z.literal("cancel"), businessId: businessIdSchema, submissionId: z.string().uuid(), eInvoiceDocumentId: z.string().uuid(), reason: z.string().trim().min(10).max(300), confirmation: z.literal("CANCEL MYINVOIS DOCUMENT") }).strict(),
]);

const secrets = new EnvironmentSecretProvider();
const oauth = new MyInvoisOAuthClient(secrets, {
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

function safeErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") return error.code;
  return error instanceof Error ? error.name : "unknown";
}

function persistenceErrorResponse(error: unknown): { message: string; status: number } | null {
  const code = safeErrorCode(error);
  if (code === "42501") {
    return {
      message: "Database permissions blocked the immutable payload snapshot. Apply the latest Supabase migrations and try again.",
      status: 503,
    };
  }
  if (code === "42P01") {
    return {
      message: "The e-Invoice payload table is missing. Apply the latest Supabase migrations and try again.",
      status: 503,
    };
  }
  if (code === "42703" || code === "PGRST204") {
    return {
      message: "The e-Invoice payload table is missing a required column. Apply the latest Supabase migrations and refresh the schema cache.",
      status: 503,
    };
  }
  if (code === "42883") {
    return {
      message: "A required e-Invoice database function is missing. Apply the latest Supabase migrations and try again.",
      status: 503,
    };
  }
  if (code === "23514") {
    return {
      message: "The approved revision no longer satisfies the immutable payload checks. Create and approve a new revision before preparing its payload.",
      status: 409,
    };
  }
  return null;
}

async function member(client: Client, businessId: string) {
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) return null;
  const { data, error } = await client.from("business_members").select("role")
    .eq("business_id", businessId).eq("user_id", auth.user.id).eq("status", "active").maybeSingle();
  return error || !data ? null : { userId: auth.user.id, role: data.role, lastSignInAt: auth.user.last_sign_in_at };
}

function recentlyAuthenticated(lastSignInAt?: string) {
  return Boolean(lastSignInAt && Date.now() - new Date(lastSignInAt).valueOf() <= 15 * 60 * 1000);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = z.object({ businessId: businessIdSchema, environment: environmentSchema.default("sandbox") }).safeParse({
    businessId: url.searchParams.get("businessId"), environment: url.searchParams.get("environment") ?? "sandbox",
  });
  if (!parsed.success) return responseError("Choose a valid business and environment.", 400);
  const client = await createSupabaseServerClient();
  if (!await member(client, parsed.data.businessId)) return responseError("You do not have access to this business.", 403);
  try {
    const repository = new SupabaseEInvoiceSubmissionRepository(client);
    const [candidates, submissions, connection] = await Promise.all([
      repository.listSubmissionCandidates(parsed.data.businessId, parsed.data.environment),
      repository.listSubmissions(parsed.data.businessId),
      repository.findConnection(parsed.data.businessId, parsed.data.environment),
    ]);
    const environmentSubmissions = submissions.filter((submission) => submission.environment === parsed.data.environment);
    const attemptedPayloadIds = new Set(environmentSubmissions.flatMap((submission) => submission.documents.map((document) => document.payloadSnapshotId)));
    return NextResponse.json({
      environment: parsed.data.environment,
      taxpayerIdentity: connection?.onbehalfofValue,
      productionReady: parsed.data.environment === "production" && Boolean(connection?.enabled && connection.verifiedAt && connection.productionActivatedAt && !connection.productionDisabledAt),
      candidates: candidates.filter((item) => item.approved && item.active && item.submissionEligible && !attemptedPayloadIds.has(item.payloadSnapshotId)).map((item) => ({
        payloadSnapshotId: item.payloadSnapshotId,
        eInvoiceDocumentId: item.eInvoiceDocumentId,
        invoiceCodeNumber: item.invoiceCodeNumber,
        encodedSizeBytes: Buffer.byteLength(Buffer.from(item.unsignedPayload, "utf8").toString("base64"), "utf8"),
        documentVersion: item.documentVersion,
        scenario: item.scenario,
        productionEligible: item.scenario === "b2b_invoice",
        ineligibilityReason: item.scenario === "b2b_invoice"
          ? undefined
          : "Production submission is currently limited to verified standard Malaysian B2B invoices.",
      })),
      submissions: environmentSubmissions,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[e-invoices.submissions.load_failed]", {
      businessId: parsed.data.businessId,
      environment: parsed.data.environment,
      code: safeErrorCode(error),
    });
    return responseError("We could not load MyInvois submission status.", 500);
  }
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return responseError("Check the sandbox submission request and try again.", 400);
  const client = await createSupabaseServerClient();
  const membership = await member(client, parsed.data.businessId);
  if (!membership) return responseError("You do not have access to this business.", 403);
  if (!['owner', 'admin'].includes(membership.role)) return responseError("Only an owner or admin can submit or refresh MyInvois records.", 403);
  const highRisk = parsed.data.action === "cancel" || (parsed.data.action === "submit" && parsed.data.environment === "production");
  if (highRisk && !recentlyAuthenticated(membership.lastSignInAt)) return responseError("Sign in again before this high-risk MyInvois action.", 401);
  if (parsed.data.action === "submit" && parsed.data.environment === "production" && parsed.data.confirmation !== "SUBMIT TO MYINVOIS PRODUCTION") {
    return responseError("Production submission confirmation is required.", 400);
  }
  const repository = new SupabaseEInvoiceSubmissionRepository(client);
  const service = new EInvoiceSubmissionService(repository, transport);
  try {
    const result = parsed.data.action === "generate_v1_0"
      ? await new GenerateEInvoicePayloadSnapshotService(new SupabaseEInvoiceRepository(client))
        .generate(parsed.data.businessId, parsed.data.documentId, new Date().toISOString())
      : parsed.data.action === "preview"
      ? await service.preview(parsed.data.businessId, parsed.data.environment, parsed.data.payloadSnapshotIds)
      : parsed.data.action === "submit"
        ? await service.submit(parsed.data.businessId, parsed.data.environment, parsed.data.payloadSnapshotIds, new Date().toISOString())
        : parsed.data.action === "cancel"
          ? await service.cancel(parsed.data.businessId, parsed.data.submissionId, parsed.data.eInvoiceDocumentId, parsed.data.reason, new Date().toISOString())
          : await service.refresh(parsed.data.businessId, parsed.data.submissionId, new Date().toISOString());
    return NextResponse.json({ result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const actionable = error instanceof EInvoiceSubmissionServiceError || error instanceof EInvoicePayloadGenerationError;
    const persistenceFailure = persistenceErrorResponse(error);
    console.error("[e-invoices.submissions.operation_failed]", {
      businessId: parsed.data.businessId,
      action: parsed.data.action,
      code: actionable ? error.code : safeErrorCode(error),
    });
    return responseError(
      actionable ? error.message : persistenceFailure?.message ?? "The MyInvois operation could not be completed safely.",
      actionable ? 409 : persistenceFailure?.status ?? 502,
    );
  }
}
