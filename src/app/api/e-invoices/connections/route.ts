import { NextResponse } from "next/server";
import { z } from "zod";
import { EInvoiceConnectionService } from "@/application/e-invoices";
import {
  EnvironmentSecretProvider,
  MyInvoisOAuthClient,
} from "@/integrations/myinvois";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { SupabaseEInvoiceRepository } from "@/repositories";

export const runtime = "nodejs";

const businessIdSchema = z.string().uuid();
const environmentSchema = z.enum(["sandbox", "production"]);
const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("test_connection"), businessId: businessIdSchema, environment: environmentSchema }).strict(),
  z.object({
    action: z.literal("configure_sandbox"), businessId: businessIdSchema,
    authMode: z.enum(["taxpayer", "intermediary"]),
    taxpayerTin: z.string().trim().toUpperCase().regex(/^[A-Z]{1,2}[0-9]{8,14}$/),
    taxpayerRegistrationValue: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{1,30}$/).optional(),
  }).strict(),
]);

const secrets = new EnvironmentSecretProvider();
const oauth = new MyInvoisOAuthClient(secrets, {
  identityBaseUrls: {
    sandbox: process.env.MYINVOIS_SANDBOX_IDENTITY_BASE_URL ?? "https://preprod-api.myinvois.hasil.gov.my",
    production: process.env.MYINVOIS_PRODUCTION_IDENTITY_BASE_URL ?? "https://api.myinvois.hasil.gov.my",
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

function connectionPersistenceErrorResponse(error: unknown): { message: string; status: number } {
  const code = safeErrorCode(error);
  if (code === "42501") {
    return {
      message: "Database permissions blocked this MyInvois connection. Confirm that your account is an owner, admin, or accountant for this business and try again.",
      status: 403,
    };
  }
  if (code === "42P01") {
    return {
      message: "The MyInvois connection table is missing. Apply the latest Supabase migrations and try again.",
      status: 503,
    };
  }
  if (code === "42703" || code === "PGRST204") {
    return {
      message: "The MyInvois connection table is missing a required field. Refresh the Supabase schema cache and try again.",
      status: 503,
    };
  }
  if (code === "23514" || code === "22P02") {
    return {
      message: "The taxpayer identity was rejected by the database. Use the MyInvois TIN and, if supplied, an uppercase ROB registration value without spaces.",
      status: 409,
    };
  }
  return {
    message: `We could not save the sandbox MyInvois connection (reference: ${code}). Check the server log using this reference and try again.`,
    status: 409,
  };
}

async function elevatedMember(client: Client, businessId: string) {
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) return null;
  const { data, error } = await client.from("business_members").select("role")
    .eq("business_id", businessId).eq("user_id", auth.user.id).eq("status", "active").maybeSingle();
  if (error || !data || !["owner", "admin", "accountant"].includes(data.role)) return null;
  return { userId: auth.user.id, role: data.role };
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return responseError("Check the MyInvois request details and try again.", 400);
  const client = await createSupabaseServerClient();
  const member = await elevatedMember(client, parsed.data.businessId);
  if (!member) return responseError("An owner, admin, or accountant role is required for MyInvois connection operations.", 403);
  const repository = new SupabaseEInvoiceRepository(client);
  if (parsed.data.action === "configure_sandbox") {
    try {
      const connection = await repository.upsertConnection({
        businessId: parsed.data.businessId,
        environment: "sandbox",
        authMode: parsed.data.authMode,
        taxpayerTin: parsed.data.taxpayerTin,
        ...(parsed.data.taxpayerRegistrationValue ? {
          taxpayerRegistrationScheme: "ROB",
          taxpayerRegistrationValue: parsed.data.taxpayerRegistrationValue,
        } : {}),
        credentialSetId: "sandbox-primary",
        clientIdSecretRef: "env:sandbox:MYINVOIS_SANDBOX_CLIENT_ID",
        clientSecretSecretRef: "env:sandbox:MYINVOIS_SANDBOX_CLIENT_SECRET",
        enabled: true,
      });
      return NextResponse.json({ result: {
        environment: connection.environment,
        authMode: connection.authMode,
        taxpayerIdentity: connection.onbehalfofValue,
        enabled: connection.enabled,
      } }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      const code = safeErrorCode(error);
      console.error("[myinvois.connection.save_failed]", { businessId: parsed.data.businessId, code });
      const response = connectionPersistenceErrorResponse(error);
      return responseError(response.message, response.status);
    }
  }
  const service = new EInvoiceConnectionService(repository, oauth);
  const now = new Date().toISOString();
  try {
    const result = await service.testConnection(parsed.data.businessId, parsed.data.environment, member.userId, now);
    return NextResponse.json({ result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String(error.code) : "operation.failed";
    const actionable = code.startsWith("connection.");
    const message = actionable && error instanceof Error
      ? error.message
      : "The MyInvois operation could not be completed. Check the server-side connection configuration and try again.";
    return responseError(message, code.endsWith("not_found") ? 404 : 409);
  }
}
