import { NextResponse } from "next/server";
import { z } from "zod";
import { assessReadiness, loanTermsSchema, readinessTransactionSchema } from "@/domain/loan-readiness";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

const businessIdSchema = z.string().uuid();
const requestSchema = z.object({ businessId: businessIdSchema, terms: loanTermsSchema.optional() }).strict();

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

async function hasMembership(client: Client, businessId: string) {
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) return false;
  const { data, error: membershipError } = await client.from("business_members").select("role")
    .eq("business_id", businessId).eq("user_id", auth.user.id).eq("status", "active").maybeSingle();
  return !membershipError && Boolean(data);
}

async function assessment(client: Client, businessId: string, terms?: z.infer<typeof loanTermsSchema>) {
  const { data, error: queryError } = await client.from("transactions")
    .select("id,transaction_date,direction,lifecycle,category_code,total_minor,confidence_score")
    .eq("business_id", businessId)
    .eq("currency", "MYR")
    .neq("lifecycle", "voided")
    .order("transaction_date", { ascending: true })
    .range(0, 9_999);
  if (queryError) throw queryError;
  const transactions = (data ?? []).map((row) => readinessTransactionSchema.parse({
    id: row.id,
    date: row.transaction_date,
    direction: row.direction,
    lifecycle: row.lifecycle,
    categoryCode: row.category_code,
    amount: row.total_minor / 100,
    confidence: row.confidence_score,
  }));
  return assessReadiness({ transactions, terms });
}

export async function GET(request: Request) {
  const businessId = businessIdSchema.safeParse(new URL(request.url).searchParams.get("businessId"));
  if (!businessId.success) return error("Choose a valid business.", 400);
  const client = await createSupabaseServerClient();
  if (!await hasMembership(client, businessId.data)) return error("You do not have access to this business.", 403);
  try {
    return NextResponse.json(await assessment(client, businessId.data), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return error("We could not calculate loan readiness. Please try again.", 500);
  }
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !parsed.data.terms) return error("Check the loan terms and try again.", 400);
  const client = await createSupabaseServerClient();
  if (!await hasMembership(client, parsed.data.businessId)) return error("You do not have access to this business.", 403);
  try {
    return NextResponse.json(await assessment(client, parsed.data.businessId, parsed.data.terms), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return error("We could not calculate this simulation. Please try again.", 500);
  }
}
