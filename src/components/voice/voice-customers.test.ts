import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Party } from "@/domain";

const partyServiceMocks = vi.hoisted(() => ({
  listSupabaseParties: vi.fn(),
  createSupabaseParty: vi.fn(),
}));

vi.mock("@/services/party-service", () => partyServiceMocks);

import { createVoiceCustomerResolver, matchCustomers, partyToVoiceCustomer, type VoiceCustomer } from "./voice-customers";

const fakeParty = (overrides: Record<string, unknown>): Party =>
  ({
    id: "party_x",
    kind: "business",
    legalName: "Test Party",
    roles: ["buyer", "customer"],
    taxIdentifiers: [],
    registrationIdentifiers: [],
    createdAt: "2026-07-15T00:00:00.000Z",
    updatedAt: "2026-07-15T00:00:00.000Z",
    ...overrides,
  }) as unknown as Party;

describe("matchCustomers", () => {
  const customers: VoiceCustomer[] = [
    { id: "1", name: "Mei Enterprise", email: null, tin: null },
    { id: "2", name: "Kedai Murni", email: null, tin: null },
    { id: "3", name: "Mei Trading", email: null, tin: null },
  ];

  it("ranks a prefix match above a token match", () => {
    const results = matchCustomers(customers, "mei");
    expect(results[0].name).toBe("Mei Enterprise");
    expect(results.map((customer) => customer.id)).toContain("3");
    expect(results.map((customer) => customer.id)).not.toContain("2");
  });

  it("returns everyone (capped) for an empty query", () => {
    expect(matchCustomers(customers, "", 2)).toHaveLength(2);
  });
});

describe("partyToVoiceCustomer", () => {
  it("extracts the TIN and email", () => {
    const party = fakeParty({ id: "p1", legalName: "Mei", email: "mei@demo.test", taxIdentifiers: [{ scheme: "tin", value: "EI001" }] });
    expect(partyToVoiceCustomer(party)).toEqual({ id: "p1", name: "Mei", email: "mei@demo.test", tin: "EI001" });
  });
});

describe("createVoiceCustomerResolver (demo mode)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("lists customers derived from the demo seed", async () => {
    const resolver = createVoiceCustomerResolver({ mode: "demo", businessId: "business_demo" });
    const customers = await resolver.list();
    expect(customers.length).toBeGreaterThanOrEqual(3);
    expect(customers.map((customer) => customer.name)).toContain("Kedai Murni");
    expect(partyServiceMocks.listSupabaseParties).not.toHaveBeenCalled();
  });

  it("persists a created customer and includes it in later lists", async () => {
    const resolver = createVoiceCustomerResolver({ mode: "demo", businessId: "business_demo" });
    const created = await resolver.create({ name: "Baru Trading", tin: "C12345678900" });
    expect(created).toMatchObject({ name: "Baru Trading", tin: "C12345678900" });
    const customers = await resolver.list();
    expect(customers.map((customer) => customer.name)).toContain("Baru Trading");
    expect(customers.map((customer) => customer.name)).toContain("Kedai Murni");
  });
});

describe("createVoiceCustomerResolver (supabase mode)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads and writes through the party service", async () => {
    partyServiceMocks.listSupabaseParties.mockResolvedValue([fakeParty({ id: "p9", legalName: "Cloud Co", taxIdentifiers: [{ scheme: "tin", value: "EI999" }] })]);
    partyServiceMocks.createSupabaseParty.mockImplementation(async (_businessId: string, party: Party) => party);
    const resolver = createVoiceCustomerResolver({ mode: "supabase", businessId: "biz-1" });

    const listed = await resolver.list();
    expect(listed).toEqual([{ id: "p9", name: "Cloud Co", email: null, tin: "EI999" }]);

    await resolver.create({ name: "New Co", tin: "EI123" });
    expect(partyServiceMocks.createSupabaseParty).toHaveBeenCalledTimes(1);
    expect(partyServiceMocks.createSupabaseParty.mock.calls[0][0]).toBe("biz-1");
  });
});
