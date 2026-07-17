import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

export const runtime = "nodejs";

const businessIdSchema = z.string().uuid();
const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("verify_sandbox"), businessId: businessIdSchema, reason: z.string().trim().min(10).max(300) }).strict(),
  z.object({ action: z.literal("activate_production"), businessId: businessIdSchema, reason: z.string().trim().min(10).max(300), confirmation: z.literal("ACTIVATE MYINVOIS PRODUCTION") }).strict(),
  z.object({ action: z.literal("disable_production"), businessId: businessIdSchema, reason: z.string().trim().min(10).max(300), confirmation: z.literal("DISABLE MYINVOIS PRODUCTION") }).strict(),
]);

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const businessId = businessIdSchema.safeParse(new URL(request.url).searchParams.get("businessId"));
  if (!businessId.success) return error("Choose a valid business.", 400);
  const client = await createSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return error("Sign in to view MyInvois operations.", 401);
  const membership = await client.from("business_members").select("role").eq("business_id", businessId.data)
    .eq("user_id", auth.user.id).eq("status", "active").maybeSingle();
  if (!membership.data || !["owner", "admin", "accountant"].includes(membership.data.role)) return error("You do not have access to MyInvois operations.", 403);
  const [connections, events, deadLetters] = await Promise.all([
    client.from("myinvois_connections").select("environment,enabled,document_version,verified_at,sandbox_verified_at,production_activated_at,production_disabled_at,production_activation_reason")
      .eq("business_id", businessId.data).order("environment"),
    client.from("e_invoice_operation_events").select("id,environment,action,target_type,target_id,reason,outcome,correlation_id,occurred_at")
      .eq("business_id", businessId.data).order("occurred_at", { ascending: false }).limit(100),
    client.from("e_invoice_submissions").select("id,environment,retry_count,dead_lettered_at,dead_letter_reason")
      .eq("business_id", businessId.data).eq("status", "dead_letter").order("dead_lettered_at", { ascending: false }),
  ]);
  if (connections.error || events.error || deadLetters.error) return error("MyInvois operations could not be loaded.", 500);
  return NextResponse.json({ connections: connections.data, events: events.data, deadLetters: deadLetters.data }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error("Check the production operations request.", 400);
  const client = await createSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return error("Sign in to manage MyInvois production.", 401);
  if (!auth.user.last_sign_in_at || Date.now() - new Date(auth.user.last_sign_in_at).valueOf() > 15 * 60 * 1000) {
    return error("Sign in again before changing MyInvois production activation.", 401);
  }
  const rpc = parsed.data.action === "verify_sandbox"
    ? await client.rpc("mark_e_invoice_sandbox_verified", { p_business_id: parsed.data.businessId, p_reason: parsed.data.reason })
    : await client.rpc("set_e_invoice_production_activation", {
      p_business_id: parsed.data.businessId,
      p_enabled: parsed.data.action === "activate_production",
      p_reason: parsed.data.reason,
    });
  if (rpc.error) return error("The production activation gate rejected this change. Verify the role, credentials, and sandbox checklist.", 409);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
