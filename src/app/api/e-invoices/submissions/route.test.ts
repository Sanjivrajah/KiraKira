import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  generate: vi.fn(),
  listSubmissionCandidates: vi.fn(),
  listAttemptedPayloadSnapshotIds: vi.fn(),
  listSubmissionHistory: vi.fn(),
  listSubmissionAttention: vi.fn(),
  findConnection: vi.fn(),
}));

vi.mock("@/lib/supabase/server-client", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));
vi.mock("@/repositories", () => ({
  SupabaseEInvoiceRepository: class SupabaseEInvoiceRepository {},
  SupabaseEInvoiceSubmissionRepository: class SupabaseEInvoiceSubmissionRepository {
    listSubmissionCandidates = mocks.listSubmissionCandidates;
    listAttemptedPayloadSnapshotIds = mocks.listAttemptedPayloadSnapshotIds;
    listSubmissionHistory = mocks.listSubmissionHistory;
    listSubmissionAttention = mocks.listSubmissionAttention;
    findConnection = mocks.findConnection;
  },
}));
vi.mock("@/integrations/myinvois", () => ({
  EnvironmentSecretProvider: class EnvironmentSecretProvider {},
  MyInvoisOAuthClient: class MyInvoisOAuthClient {},
  MyInvoisSubmissionTransport: class MyInvoisSubmissionTransport {},
}));
vi.mock("@/application/e-invoices", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/application/e-invoices")>();
  return {
    ...actual,
    EInvoiceSubmissionService: class EInvoiceSubmissionService {},
    GenerateEInvoicePayloadSnapshotService: class GenerateEInvoicePayloadSnapshotService {
      generate = mocks.generate;
    },
  };
});

import { EInvoicePayloadGenerationError } from "@/application/e-invoices";
import { GET, POST } from "./route";

const businessId = "11111111-1111-4111-8111-111111111111";
const documentId = "22222222-2222-4222-8222-222222222222";

function client() {
  const membership = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { role: "owner" }, error: null }),
  };
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1", last_sign_in_at: "2026-07-17T10:00:00.000Z" } },
        error: null,
      }),
    },
    from: vi.fn(() => membership),
  };
}

function generatePayload() {
  return POST(new Request("http://localhost/api/e-invoices/submissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "generate_v1_0", businessId, documentId }),
  }));
}

describe("/api/e-invoices/submissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createSupabaseServerClient.mockResolvedValue(client());
    mocks.listSubmissionCandidates.mockResolvedValue([]);
    mocks.listAttemptedPayloadSnapshotIds.mockResolvedValue([]);
    mocks.listSubmissionHistory.mockResolvedValue({ submissions: [] });
    mocks.listSubmissionAttention.mockResolvedValue([]);
    mocks.findConnection.mockResolvedValue(null);
  });

  it("moves payloads with an existing attempt out of the ready list and into history", async () => {
    mocks.listSubmissionCandidates.mockResolvedValue([
      { payloadSnapshotId: "33333333-3333-4333-8333-333333333333", eInvoiceDocumentId: documentId, invoiceCodeNumber: "INV-1", unsignedPayload: "{}", documentVersion: "1.0", scenario: "b2b_invoice", approved: true, active: true, submissionEligible: true },
      { payloadSnapshotId: "44444444-4444-4444-8444-444444444444", eInvoiceDocumentId: "55555555-5555-4555-8555-555555555555", invoiceCodeNumber: "INV-2", unsignedPayload: "{}", documentVersion: "1.0", scenario: "b2b_invoice", approved: true, active: true, submissionEligible: true },
    ]);
    const failedSubmission = {
      id: "66666666-6666-4666-8666-666666666666", businessId, environment: "sandbox", idempotencyKey: "a".repeat(64), requestHash: "b".repeat(64),
      status: "failed", requestedAt: "2026-07-17T11:23:00.000Z", retryCount: 0,
      documents: [{ submissionId: "66666666-6666-4666-8666-666666666666", eInvoiceDocumentId: documentId, payloadSnapshotId: "33333333-3333-4333-8333-333333333333", invoiceCodeNumber: "INV-1", status: "failed" }],
    };
    mocks.listAttemptedPayloadSnapshotIds.mockResolvedValue(["33333333-3333-4333-8333-333333333333"]);
    mocks.listSubmissionHistory.mockResolvedValue({ submissions: [failedSubmission] });
    mocks.listSubmissionAttention.mockResolvedValue([failedSubmission]);

    const response = await GET(new Request(`http://localhost/api/e-invoices/submissions?businessId=${businessId}&environment=sandbox`));
    const body = await response.json() as { candidates: Array<{ invoiceCodeNumber: string }>; submissions: unknown[] };

    expect(response.status).toBe(200);
    expect(body.candidates.map((item) => item.invoiceCodeNumber)).toEqual(["INV-2"]);
    expect(body.submissions).toHaveLength(1);
  });

  it("returns an actionable response when the payload hash database function is missing", async () => {
    mocks.generate.mockRejectedValue(Object.assign(new Error("function digest(bytea, unknown) does not exist"), { code: "42883" }));

    const response = await generatePayload();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "A required e-Invoice database function is missing. Apply the latest Supabase migrations and try again.",
    });
  });

  it("returns typed payload-generation errors as conflicts instead of gateway failures", async () => {
    mocks.generate.mockRejectedValue(new EInvoicePayloadGenerationError(
      "document.not_eligible",
      "Only the active approved revision can generate a payload.",
    ));

    const response = await generatePayload();

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Only the active approved revision can generate a payload.",
    });
  });
});
