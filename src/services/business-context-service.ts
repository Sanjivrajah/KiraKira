import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import type { Business, BusinessInput } from "@/types";

type SupabaseBusinessRow = {
  id: string;
  legal_name: string;
  trading_name: string | null;
  entity_type: string;
  default_currency: string;
  preferred_language: string;
  created_at: string;
  updated_at: string;
  msic_code: string | null;
  business_activity_description: string | null;
};

function toBusiness(row: SupabaseBusinessRow): Business {
  return {
    id: row.id,
    name: row.trading_name || row.legal_name,
    type: "other",
    registrationNumber: null,
    tin: null,
    currency: "MYR",
    preferredLanguage: row.preferred_language === "ms" ? "ms" : "en",
    legalName: row.legal_name,
    tradingName: row.trading_name ?? undefined,
    entityType: row.entity_type,
    msicCode: row.msic_code ?? undefined,
    businessActivityDescription: row.business_activity_description ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * The active business is always derived from active Supabase memberships. The
 * UI may later add a picker over this list without persisting an untrusted ID.
 */
export async function getSupabaseBusinessesForUser(userId: string): Promise<Business[]> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("business_members")
    .select("businesses!inner(*)")
    .eq("user_id", userId)
    .eq("status", "active");
  if (error) throw new Error(`Could not load business memberships: ${error.message}`);
  return (data ?? []).map((membership) => toBusiness((membership as unknown as { businesses: SupabaseBusinessRow }).businesses));
}

export async function createSupabaseBusiness(input: BusinessInput): Promise<Business> {
  const { data, error } = await getSupabaseBrowserClient().rpc("create_business", {
    p_legal_name: input.legalName || input.name,
    ...(input.tradingName ? { p_trading_name: input.tradingName } : {}),
    p_entity_type: input.entityType || "other",
    p_preferred_language: input.preferredLanguage,
    ...(input.msicCode ? { p_msic_code: input.msicCode } : {}),
    ...(input.businessActivityDescription ? { p_business_activity_description: input.businessActivityDescription } : {}),
  });
  if (error) throw new Error(`Could not create business: ${error.message}`);
  if (!data) throw new Error("Business creation completed without returning a business.");
  return toBusiness(data);
}
