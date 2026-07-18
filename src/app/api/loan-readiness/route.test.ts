import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/lib/supabase/server-client", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));
import { GET, POST } from "./route";

const businessId = "11111111-1111-4111-8111-111111111111";

function client(role: string | null, transactions: object[] = []) {
  const memberships = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: role ? { role } : null, error: null }) };
  const ledger = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), neq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), range: vi.fn().mockResolvedValue({ data: transactions, error: null }),
  };
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) }, from: vi.fn((table: string) => table === "business_members" ? memberships : ledger) };
}

describe("/api/loan-readiness", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a user without an active business membership", async () => {
    mocks.createSupabaseServerClient.mockResolvedValue(client(null));
    expect((await GET(new Request(`http://localhost/api/loan-readiness?businessId=${businessId}`))).status).toBe(403);
  });

  it("validates simulation terms before reading tenant data", async () => {
    const response = await POST(new Request("http://localhost/api/loan-readiness", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId, terms: { principal: -1, annualRatePercent: 8, tenureMonths: 36 } }) }));
    expect(response.status).toBe(400);
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });
});
