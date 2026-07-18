import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  workspace: vi.fn(), prepareBatch: vi.fn(), saveFields: vi.fn(), approve: vi.fn(), createRevision: vi.fn(),
}));

vi.mock("@/lib/supabase/server-client", () => ({ createSupabaseServerClient: mocks.createSupabaseServerClient }));
vi.mock("@/repositories", () => ({ SupabaseEInvoiceRepository: class SupabaseEInvoiceRepository {} }));
vi.mock("@/application/e-invoices", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/application/e-invoices")>();
  return { ...actual, EInvoicePreparationService: class EInvoicePreparationService {
    workspace = mocks.workspace; prepareBatch = mocks.prepareBatch; saveFields = mocks.saveFields;
    approve = mocks.approve; createRevision = mocks.createRevision;
  } };
});

import { GET, POST } from "./route";

const businessId = "11111111-1111-4111-8111-111111111111";
const documentId = "22222222-2222-4222-8222-222222222222";

function client(role: string | null) {
  const membership = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: role ? { role } : null, error: null }) };
  return { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }) }, from: vi.fn(() => membership) };
}

function post(body: object) {
  return POST(new Request("http://localhost/api/e-invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
}

describe("/api/e-invoices", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.workspace.mockResolvedValue({ candidates: [], preparations: [], counts: { selected: 0, needsInformation: 0, ready: 0, approved: 0 } }); });

  it("rejects cross-tenant reads when active membership cannot be established", async () => {
    mocks.createSupabaseServerClient.mockResolvedValue(client(null));
    const response = await GET(new Request(`http://localhost/api/e-invoices?businessId=${businessId}`));
    expect(response.status).toBe(403);
    expect(mocks.workspace).not.toHaveBeenCalled();
  });

  it("allows viewers to read but not prepare records", async () => {
    mocks.createSupabaseServerClient.mockResolvedValue(client("viewer"));
    expect((await GET(new Request(`http://localhost/api/e-invoices?businessId=${businessId}`))).status).toBe(200);
    const response = await post({ action: "prepare", businessId, invoiceIds: [documentId] });
    expect(response.status).toBe(403);
    expect(mocks.prepareBatch).not.toHaveBeenCalled();
  });

  it("keeps approval owner/admin-only and passes the optimistic revision", async () => {
    mocks.createSupabaseServerClient.mockResolvedValue(client("accountant"));
    expect((await post({ action: "approve", businessId, documentId, expectedRevision: 4 })).status).toBe(403);

    mocks.createSupabaseServerClient.mockResolvedValue(client("owner"));
    mocks.approve.mockResolvedValue({ id: documentId, status: "approved" });
    const response = await post({ action: "approve", businessId, documentId, expectedRevision: 4 });
    expect(response.status).toBe(200);
    expect(mocks.approve).toHaveBeenCalledWith(businessId, documentId, 4, expect.stringMatching(/^\d{4}-/));
  });

  it("rejects arbitrary supplemental JSON before reaching the service", async () => {
    const response = await post({ action: "save_fields", businessId, documentId, expectedRevision: 1, fields: { arbitrary: "value" } });
    expect(response.status).toBe(400);
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });
});

