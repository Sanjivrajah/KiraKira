import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  testConnection: vi.fn(),
}));

vi.mock("@/lib/supabase/server-client", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));
vi.mock("@/repositories", () => ({ SupabaseEInvoiceRepository: class SupabaseEInvoiceRepository {} }));
vi.mock("@/integrations/myinvois", () => ({
  EnvironmentSecretProvider: class EnvironmentSecretProvider {},
  MyInvoisOAuthClient: class MyInvoisOAuthClient {},
}));
vi.mock("@/application/e-invoices", () => ({
  EInvoiceConnectionService: class EInvoiceConnectionService {
    testConnection = mocks.testConnection;
  },
}));

import { POST } from "./route";

const businessId = "11111111-1111-4111-8111-111111111111";

function client(role: string | null) {
  const membership = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: role ? { role } : null, error: null }) };
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) }, from: vi.fn(() => membership) };
}

function post(body: object) {
  return POST(new Request("http://localhost/api/e-invoices/connections", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }));
}

describe("/api/e-invoices/connections", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires an elevated active business membership", async () => {
    mocks.createSupabaseServerClient.mockResolvedValue(client("viewer"));
    const response = await post({ action: "test_connection", businessId, environment: "sandbox" });
    expect(response.status).toBe(403);
    expect(mocks.testConnection).not.toHaveBeenCalled();
  });

  it("tests only the server-owned business connection", async () => {
    mocks.createSupabaseServerClient.mockResolvedValue(client("accountant"));
    mocks.testConnection.mockResolvedValue({ connected: true, environment: "sandbox" });
    const response = await post({ action: "test_connection", businessId, environment: "sandbox" });
    expect(response.status).toBe(200);
    expect(mocks.testConnection).toHaveBeenCalledWith(businessId, "sandbox", "user-1", expect.stringMatching(/^\d{4}-/));
  });

  it("rejects caller-supplied delegation overrides", async () => {
    const response = await post({ action: "test_connection", businessId, environment: "sandbox", onbehalfof: "C99999999990" });
    expect(response.status).toBe(400);
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });
});
