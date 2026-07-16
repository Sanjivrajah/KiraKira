import { NextResponse } from "next/server";
import { z } from "zod";
import { createTelegramLinkCode, TELEGRAM_LINK_CODE_TTL_MS } from "@/features/transaction-agent/telegram-linking";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

const requestSchema = z.object({ businessId: z.string().uuid() }).strict();
// These are the roles allowed to create transactions. A link code is scoped
// to the caller, so allowing a staff member to link their own Telegram chat
// does not grant access to another business or account.
const eligibleRoles = ["owner", "admin", "accountant", "staff"] as const;

function failure(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Lists businesses that may issue a Telegram link. The caller is always derived from the auth cookie. */
export async function GET() {
  const client = await createSupabaseServerClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) return failure("Sign in before linking Telegram.", 401);

  const { data, error } = await client
    .from("business_members")
    .select("business_id,businesses!inner(legal_name,trading_name)")
    .eq("user_id", auth.user.id)
    .eq("status", "active")
    .in("role", eligibleRoles);
  if (error) return failure("Could not load businesses eligible for Telegram linking.", 500);

  const businesses = (data ?? []).map((membership) => {
    const business = membership.businesses as unknown as { legal_name: string; trading_name: string | null };
    return { id: membership.business_id, name: business.trading_name || business.legal_name };
  });
  return NextResponse.json({ businesses }, { headers: { "Cache-Control": "no-store" } });
}

/** Issues a raw link code once; only its digest is stored by Supabase. */
export async function POST(request: Request) {
  let body: z.infer<typeof requestSchema>;
  try { body = requestSchema.parse(await request.json()); }
  catch { return failure("Choose a valid business before linking Telegram.", 400); }

  const client = await createSupabaseServerClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) return failure("Sign in before linking Telegram.", 401);

  const { data: membership, error: membershipError } = await client
    .from("business_members")
    .select("business_id")
    .eq("business_id", body.businessId)
    .eq("user_id", auth.user.id)
    .eq("status", "active")
    .in("role", eligibleRoles)
    .maybeSingle();
  if (membershipError || !membership) return failure("You do not have permission to link Telegram for that business.", 403);

  const { code, codeHash } = createTelegramLinkCode();
  const expiresAt = new Date(Date.now() + TELEGRAM_LINK_CODE_TTL_MS).toISOString();
  const { error } = await client.from("telegram_link_codes").insert({
    user_id: auth.user.id,
    business_id: membership.business_id,
    code_hash: codeHash,
    expires_at: expiresAt,
  });
  if (error) return failure("Could not create a Telegram link code. Please try again.", 500);

  return NextResponse.json({ code, expiresAt }, { headers: { "Cache-Control": "no-store" } });
}
