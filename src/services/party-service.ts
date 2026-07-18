import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { normalizeMalaysiaStateCode } from "@/compliance/myinvois/reference-data/malaysia-states";
import { partyDomainToEditor } from "@/frontend/view-models";
import { partySchema, type Party } from "@/domain";

type PartyRow = {
  id: string; kind: Party["kind"]; legal_name: string; trading_name: string | null;
  roles: string[]; email: string | null; phone: string | null; default_currency: string | null;
  default_payment_terms_days: number | null; created_at: string; updated_at: string;
  party_tax_identifiers: Array<{ scheme: string; value: string; issuing_country_code: string | null; description: string | null }>;
  party_registration_identifiers: Array<{ scheme: string; value: string; issuing_country_code: string | null; description: string | null }>;
  party_addresses: Array<{ address_type: string; line1: string; line2: string | null; line3: string | null; city: string; postal_code: string | null; state_code: string | null; country_code: string }>;
};

function toParty(row: PartyRow): Party {
  const address = (type: string) => {
    const value = row.party_addresses.find((item) => item.address_type === type);
    return value ? {
      addressLines: [value.line1, value.line2, value.line3].filter((line): line is string => Boolean(line)),
      city: value.city, postcode: value.postal_code ?? undefined,
      stateCode: value.country_code === "MY" ? normalizeMalaysiaStateCode(value.state_code ?? undefined) || undefined : value.state_code ?? undefined,
      countryCode: value.country_code,
    } : undefined;
  };
  return partySchema.parse({
    id: row.id, kind: row.kind, legalName: row.legal_name, tradingName: row.trading_name ?? undefined,
    roles: row.roles as Party["roles"], email: row.email ?? undefined, phone: row.phone ?? undefined,
    defaultCurrency: row.default_currency ?? undefined, defaultPaymentTermsDays: row.default_payment_terms_days ?? undefined,
    taxIdentifiers: row.party_tax_identifiers.map((item) => ({ scheme: item.scheme as Party["taxIdentifiers"][number]["scheme"], value: item.value, issuingCountryCode: item.issuing_country_code ?? undefined, description: item.description ?? undefined })),
    registrationIdentifiers: row.party_registration_identifiers.map((item) => ({ scheme: item.scheme as Party["registrationIdentifiers"][number]["scheme"], value: item.value, issuingCountryCode: item.issuing_country_code ?? undefined, description: item.description ?? undefined })),
    billingAddress: address("billing"), shippingAddress: address("shipping"), createdAt: row.created_at, updatedAt: row.updated_at,
  });
}

const selection = "id,kind,legal_name,trading_name,roles,email,phone,default_currency,default_payment_terms_days,created_at,updated_at,party_tax_identifiers(scheme,value,issuing_country_code,description),party_registration_identifiers(scheme,value,issuing_country_code,description),party_addresses(address_type,line1,line2,line3,city,postal_code,state_code,country_code)";

export async function listSupabaseParties(businessId: string): Promise<Party[]> {
  const { data, error } = await getSupabaseBrowserClient().from("parties").select(selection).eq("business_id", businessId).contains("roles", ["buyer"]).order("legal_name");
  if (error) throw new Error(`Could not load customers: ${error.message}`);
  return (data as unknown as PartyRow[]).map(toParty);
}

export async function createSupabaseParty(businessId: string, party: Party): Promise<Party> {
  const client = getSupabaseBrowserClient();
  const { data: created, error } = await client.from("parties").insert({
    business_id: businessId, kind: party.kind, legal_name: party.legalName, trading_name: party.tradingName,
    roles: party.roles, email: party.email, phone: party.phone, default_currency: party.defaultCurrency,
    default_payment_terms_days: party.defaultPaymentTermsDays,
  }).select("id").single();
  if (error) throw new Error(`Could not create customer: ${error.message}`);

  const childWrites: PromiseLike<{ error: { message: string } | null }>[] = [];
  if (party.taxIdentifiers.length) childWrites.push(client.from("party_tax_identifiers").insert(party.taxIdentifiers.map((item) => ({ party_id: created.id, scheme: item.scheme, value: item.value, issuing_country_code: item.issuingCountryCode, description: item.description }))));
  if (party.registrationIdentifiers.length) childWrites.push(client.from("party_registration_identifiers").insert(party.registrationIdentifiers.map((item) => ({ party_id: created.id, scheme: item.scheme, value: item.value, issuing_country_code: item.issuingCountryCode, description: item.description }))));
  if (party.billingAddress) childWrites.push(client.from("party_addresses").insert({ party_id: created.id, address_type: "billing", line1: party.billingAddress.addressLines[0], line2: party.billingAddress.addressLines[1], line3: party.billingAddress.addressLines[2], city: party.billingAddress.city, postal_code: party.billingAddress.postcode, state_code: party.billingAddress.stateCode, country_code: party.billingAddress.countryCode, is_primary: true }));
  if (party.shippingAddress) childWrites.push(client.from("party_addresses").insert({ party_id: created.id, address_type: "shipping", line1: party.shippingAddress.addressLines[0], line2: party.shippingAddress.addressLines[1], line3: party.shippingAddress.addressLines[2], city: party.shippingAddress.city, postal_code: party.shippingAddress.postcode, state_code: party.shippingAddress.stateCode, country_code: party.shippingAddress.countryCode, is_primary: true }));
  const results = await Promise.all(childWrites);
  const childError = results.find((result) => result.error)?.error;
  if (childError) throw new Error(`Customer was created but some details could not be saved: ${childError.message}`);

  const { data, error: reloadError } = await client.from("parties").select(selection).eq("id", created.id).single();
  if (reloadError) throw new Error(`Customer was created but could not be reloaded: ${reloadError.message}`);
  return toParty(data as unknown as PartyRow);
}

export async function updateSupabaseParty(businessId: string, party: Party): Promise<Party> {
  const input = partyDomainToEditor(party);
  const client = getSupabaseBrowserClient();
  const rpcClient = client as unknown as { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> };
  const { error } = await rpcClient.rpc("update_party_einvoice_profile", {
    p_business_id: businessId,
    p_party_id: party.id,
    p_party: input,
  });
  if (error) throw new Error(`Could not update customer details: ${error.message}`);
  const { data, error: reloadError } = await client.from("parties").select(selection).eq("business_id", businessId).eq("id", party.id).single();
  if (reloadError) throw new Error(`Customer details were updated but could not be reloaded: ${reloadError.message}`);
  return toParty(data as unknown as PartyRow);
}
