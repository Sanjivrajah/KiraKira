import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>> }));

vi.mock("@/lib/supabase/browser-client", () => ({
  getSupabaseBrowserClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          contains: () => ({
            order: async () => ({ data: mocks.rows, error: null }),
          }),
        }),
      }),
    }),
  }),
}));

import { listSupabaseParties } from "./party-service";

function partyRow(defaultCurrency: string | null) {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    kind: "business",
    legal_name: "Customer Sdn. Bhd.",
    trading_name: null,
    roles: ["buyer", "customer"],
    email: null,
    phone: null,
    default_currency: defaultCurrency,
    default_payment_terms_days: null,
    created_at: "2026-07-17T00:00:00.000Z",
    updated_at: "2026-07-17T00:00:00.000Z",
    party_tax_identifiers: [],
    party_registration_identifiers: [],
    party_addresses: [],
  };
}

describe("listSupabaseParties", () => {
  beforeEach(() => { mocks.rows = []; });

  it("normalizes a nullable database currency to an absent optional domain value", async () => {
    mocks.rows = [partyRow(null)];
    await expect(listSupabaseParties("20000000-0000-4000-8000-000000000001"))
      .resolves.toEqual([expect.objectContaining({ legalName: "Customer Sdn. Bhd.", defaultCurrency: undefined })]);
  });

  it("preserves a configured customer currency", async () => {
    mocks.rows = [partyRow("MYR")];
    await expect(listSupabaseParties("20000000-0000-4000-8000-000000000001"))
      .resolves.toEqual([expect.objectContaining({ defaultCurrency: "MYR" })]);
  });
});
