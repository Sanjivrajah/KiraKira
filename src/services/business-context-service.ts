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
  business_tax_identifiers?: Array<{ scheme: string; value: string; is_primary: boolean }>;
  business_registration_identifiers?: Array<{ scheme: string; value: string; is_primary: boolean }>;
  business_addresses?: Array<{ line1: string; line2: string | null; city: string; postal_code: string | null; state_code: string | null; country_code: string; is_primary: boolean }>;
  business_contacts?: Array<{ contact_type: string; value: string; is_primary: boolean }>;
};

function toBusiness(row: SupabaseBusinessRow): Business {
  const address = row.business_addresses?.find((item) => item.is_primary) ?? row.business_addresses?.[0];
  const contact = (type: string) => row.business_contacts?.find((item) => item.contact_type === type && item.is_primary)?.value ?? row.business_contacts?.find((item) => item.contact_type === type)?.value;
  const registration = row.business_registration_identifiers?.find((identifier) => identifier.is_primary) ?? row.business_registration_identifiers?.[0];
  return {
    id: row.id,
    name: row.trading_name || row.legal_name,
    type: "other",
    registrationNumber: registration?.value ?? null,
    tin: row.business_tax_identifiers?.find((identifier) => identifier.scheme === "tin" && identifier.is_primary)?.value ?? row.business_tax_identifiers?.find((identifier) => identifier.scheme === "tin")?.value ?? null,
    currency: row.default_currency === "MYR" ? "MYR" : "MYR",
    preferredLanguage: row.preferred_language === "ms" ? "ms" : "en",
    legalName: row.legal_name,
    tradingName: row.trading_name ?? undefined,
    entityType: row.entity_type,
    registrationScheme: registration?.scheme,
    sstRegistration: row.business_tax_identifiers?.find((identifier) => identifier.scheme === "sst")?.value,
    msicCode: row.msic_code ?? undefined,
    businessActivityDescription: row.business_activity_description ?? undefined,
    addressLine1: address?.line1,
    addressLine2: address?.line2 ?? undefined,
    city: address?.city,
    postcode: address?.postal_code ?? undefined,
    stateCode: address?.state_code ?? undefined,
    countryCode: address?.country_code,
    email: contact("email"),
    phone: contact("phone"),
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
    .select("businesses!inner(*,business_tax_identifiers(scheme,value,is_primary),business_registration_identifiers(scheme,value,is_primary),business_addresses(line1,line2,city,postal_code,state_code,country_code,is_primary),business_contacts(contact_type,value,is_primary))")
    .eq("user_id", userId)
    .eq("status", "active");
  if (error) throw new Error(`Could not load business memberships: ${error.message}`);
  return (data ?? []).map((membership) => toBusiness((membership as unknown as { businesses: SupabaseBusinessRow }).businesses));
}

export async function createSupabaseBusiness(input: BusinessInput): Promise<Business> {
  const client = getSupabaseBrowserClient();
  const { data, error } = await client.rpc("create_business", {
    p_legal_name: input.legalName || input.name,
    ...(input.tradingName ? { p_trading_name: input.tradingName } : {}),
    p_entity_type: input.entityType || "other",
    p_preferred_language: input.preferredLanguage,
    ...(input.msicCode ? { p_msic_code: input.msicCode } : {}),
    ...(input.businessActivityDescription ? { p_business_activity_description: input.businessActivityDescription } : {}),
    ...(input.tin ? { p_tin: input.tin } : {}),
    ...(input.registrationNumber ? { p_registration_scheme: input.registrationScheme || "brn", p_registration_value: input.registrationNumber, p_registration_country_code: input.countryCode || "MY" } : {}),
    ...(input.sstRegistration ? { p_sst_registration: input.sstRegistration } : {}),
    ...(input.addressLine1 && input.city ? { p_primary_address: { line1: input.addressLine1, line2: input.addressLine2 || null, city: input.city, postal_code: input.postcode || null, state_code: input.stateCode || null, country_code: input.countryCode || "MY" } } : {}),
    ...(input.email ? { p_primary_email: input.email } : {}),
    ...(input.phone ? { p_primary_phone: input.phone } : {}),
  });
  if (error) throw new Error(`Could not create business: ${error.message}`);
  if (!data) throw new Error("Business creation completed without returning a business.");
  const { data: reloaded, error: reloadError } = await client.from("businesses")
    .select("*,business_tax_identifiers(scheme,value,is_primary),business_registration_identifiers(scheme,value,is_primary),business_addresses(line1,line2,city,postal_code,state_code,country_code,is_primary),business_contacts(contact_type,value,is_primary)")
    .eq("id", data.id).single();
  if (reloadError) throw new Error(`Business was created but its compliance details could not be loaded: ${reloadError.message}`);
  return toBusiness(reloaded as unknown as SupabaseBusinessRow);
}
