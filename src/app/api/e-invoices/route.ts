import { NextResponse } from "next/server";
import { z } from "zod";
import { EInvoicePreparationService, preparationSupplementalSchema } from "@/application/e-invoices";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { SupabaseEInvoiceRepository } from "@/repositories";

const businessIdSchema = z.string().uuid();
const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("prepare"), businessId: businessIdSchema, invoiceIds: z.array(z.string().uuid()).min(1).max(50) }).strict(),
  z.object({ action: z.literal("save_fields"), businessId: businessIdSchema, documentId: z.string().uuid(), expectedRevision: z.number().int().nonnegative(), fields: preparationSupplementalSchema }).strict(),
  z.object({ action: z.literal("approve"), businessId: businessIdSchema, documentId: z.string().uuid(), expectedRevision: z.number().int().nonnegative() }).strict(),
  z.object({ action: z.literal("create_revision"), businessId: businessIdSchema, documentId: z.string().uuid() }).strict(),
]);

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function responseError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function safeErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") return error.code;
  return error instanceof Error ? error.name : "unknown";
}

async function membership(client: Client, businessId: string) {
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) return null;
  const { data, error } = await client.from("business_members").select("role")
    .eq("business_id", businessId).eq("user_id", auth.user.id).eq("status", "active").maybeSingle();
  if (error || !data) return null;
  return { userId: auth.user.id, role: data.role };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsedBusinessId = businessIdSchema.safeParse(url.searchParams.get("businessId"));
  if (!parsedBusinessId.success) return responseError("Choose a valid business.", 400);
  const client = await createSupabaseServerClient();
  if (!await membership(client, parsedBusinessId.data)) return responseError("You do not have access to this business.", 403);
  try {
    const repository = new SupabaseEInvoiceRepository(client);
    const workspace = await new EInvoicePreparationService(repository, repository).workspace(parsedBusinessId.data);
    return NextResponse.json(workspace, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return responseError("We could not load the e-Invoice preparation workspace.", 500);
  }
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return responseError("Check the preparation details and try again.", 400);
  const client = await createSupabaseServerClient();
  const member = await membership(client, parsed.data.businessId);
  if (!member) return responseError("You do not have access to this business.", 403);
  const canEdit = ["owner", "admin", "accountant"].includes(member.role);
  const canApprove = ["owner", "admin"].includes(member.role);
  if (!canEdit) return responseError("Your role can view preparations but cannot change them.", 403);
  if (parsed.data.action === "approve" && !canApprove) return responseError("Only an owner or admin can approve an e-Invoice preparation.", 403);

  const repository = new SupabaseEInvoiceRepository(client);
  const service = new EInvoicePreparationService(repository, repository);
  const now = new Date().toISOString();
  try {
    const result = parsed.data.action === "prepare"
      ? await service.prepareBatch(parsed.data.businessId, parsed.data.invoiceIds, now)
      : parsed.data.action === "save_fields"
        ? await service.saveFields(parsed.data.businessId, parsed.data.documentId, parsed.data.expectedRevision, parsed.data.fields, now, member.userId)
        : parsed.data.action === "approve"
          ? await service.approve(parsed.data.businessId, parsed.data.documentId, parsed.data.expectedRevision, now)
          : await service.createRevision(parsed.data.businessId, parsed.data.documentId);
    return NextResponse.json({ result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[e-invoices.preparation_failed]", {
      businessId: parsed.data.businessId,
      action: parsed.data.action,
      code: safeErrorCode(error),
    });
    const message = error instanceof Error && (
      error.message.includes("blocking internal") || error.message.includes("changed while") || error.message.includes("new revision")
    ) ? error.message : "We could not save that e-Invoice preparation. Reload and try again.";
    return responseError(message, error instanceof z.ZodError ? 400 : 409);
  }
}
