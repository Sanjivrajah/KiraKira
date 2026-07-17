import { partySchema, type Party } from "@/domain";
import { DEMO_CUSTOMERS } from "@/data/demo";
import { FRONTEND_STORAGE_KEYS } from "@/frontend/storage";
import { browserStorage } from "@/lib/storage/browser-storage";
import { createSupabaseParty, listSupabaseParties } from "@/services/party-service";
import { makeEntityId } from "@/services/id";

/** Minimal customer DTO the voice tools speak in — never a full domain Party. */
export interface VoiceCustomer {
  id: string;
  name: string;
  email: string | null;
  tin: string | null;
}

export interface VoiceCustomerInput {
  name: string;
  email?: string | null;
  tin?: string | null;
  registrationNumber?: string | null;
  phone?: string | null;
  address?: string | null;
}

/** Reads and creates customers ("parties" in the domain) for the voice layer. */
export interface VoiceCustomerResolver {
  list(): Promise<VoiceCustomer[]>;
  create(input: VoiceCustomerInput): Promise<VoiceCustomer>;
}

const tinOf = (party: Party): string | null =>
  party.taxIdentifiers.find((identifier) => identifier.scheme === "tin")?.value ?? null;

export function partyToVoiceCustomer(party: Party): VoiceCustomer {
  return { id: party.id, name: party.legalName, email: party.email ?? null, tin: tinOf(party) };
}

// Domain identifiers accept a restricted character set; skip anything a spoken
// value can't satisfy rather than failing the whole customer create.
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const identifierSafe = (value: string | null | undefined): value is string =>
  Boolean(value && IDENTIFIER_PATTERN.test(value.trim()));

/** Demo parties: stored first, otherwise derived from the demo customer seed. */
function demoParties(): Party[] {
  const stored = browserStorage.get<Party[]>(FRONTEND_STORAGE_KEYS.parties, []);
  if (stored.length) return stored;
  const now = "2026-07-15T00:00:00.000Z";
  return DEMO_CUSTOMERS.map((customer) =>
    partySchema.parse({
      id: customer.id,
      kind: "business",
      legalName: customer.name,
      roles: ["buyer", "customer"],
      taxIdentifiers: customer.tin ? [{ scheme: "tin", value: customer.tin, issuingCountryCode: "MY" }] : [],
      registrationIdentifiers: [{ scheme: "brn", value: "NA", issuingCountryCode: "MY" }],
      ...(customer.email ? { email: customer.email } : {}),
      billingAddress: { addressLines: ["Address pending review"], city: "City pending review", stateCode: "17", countryCode: "MY" },
      createdAt: now,
      updatedAt: now,
    }),
  );
}

function buildParty(input: VoiceCustomerInput, now: string): Party {
  return partySchema.parse({
    id: makeEntityId("party"),
    kind: "business",
    legalName: input.name.trim(),
    roles: ["buyer", "customer"],
    taxIdentifiers: identifierSafe(input.tin) ? [{ scheme: "tin", value: input.tin.trim(), issuingCountryCode: "MY" }] : [],
    registrationIdentifiers: identifierSafe(input.registrationNumber)
      ? [{ scheme: "brn", value: input.registrationNumber.trim(), issuingCountryCode: "MY" }]
      : [],
    ...(input.email ? { email: input.email.trim() } : {}),
    ...(input.phone && input.phone.trim().length >= 5 ? { phone: input.phone.trim() } : {}),
    billingAddress: {
      addressLines: [input.address?.trim() || "Address pending review"],
      city: "City pending review",
      stateCode: "17",
      countryCode: "MY",
    },
    createdAt: now,
    updatedAt: now,
  });
}

interface ResolverOptions {
  mode: "demo" | "supabase";
  businessId: string;
  now?: () => Date;
}

/**
 * Mode-aware customer access mirroring the invoice builder: demo persists to
 * browser storage (seeded from the demo customers), supabase uses the party
 * service under the user's RLS session.
 */
export function createVoiceCustomerResolver({ mode, businessId, now = () => new Date() }: ResolverOptions): VoiceCustomerResolver {
  return {
    async list() {
      if (mode === "supabase") return (await listSupabaseParties(businessId)).map(partyToVoiceCustomer);
      return demoParties().map(partyToVoiceCustomer);
    },
    async create(input) {
      const party = buildParty(input, now().toISOString());
      if (mode === "supabase") return partyToVoiceCustomer(await createSupabaseParty(businessId, party));
      const next = [...demoParties(), party];
      browserStorage.set(FRONTEND_STORAGE_KEYS.parties, next);
      return partyToVoiceCustomer(party);
    },
  };
}

/** Ranks a spoken name against known customers so the agent can confirm a match. */
function scoreCustomerMatch(name: string, query: string): number {
  if (name === query) return 100;
  if (name.startsWith(query)) return 80;
  if (name.includes(query)) return 60;
  const nameTokens = name.split(/\s+/).filter(Boolean);
  const queryTokens = query.split(/\s+/).filter(Boolean);
  const overlap = queryTokens.filter((token) => nameTokens.some((part) => part.includes(token))).length;
  return overlap > 0 ? 20 + overlap * 10 : 0;
}

export function matchCustomers(customers: readonly VoiceCustomer[], query: string, limit = 5): VoiceCustomer[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return customers.slice(0, limit);
  return customers
    .map((customer) => ({ customer, score: scoreCustomerMatch(customer.name.toLowerCase(), normalized) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.customer);
}
