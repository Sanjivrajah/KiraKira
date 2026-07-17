import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type {
  CreatePendingSubmissionInput,
  EInvoiceSubmissionCandidate,
  EInvoiceSubmissionRecord,
  EInvoiceSubmissionRepository,
  MyInvoisConnectionRecord,
  ReconcileSubmissionInput,
  RecordSubmissionResponseInput,
} from "./contracts";
import { EInvoiceSubmissionService } from "./submission-service";
import type { MyInvoisSubmissionTransport } from "@/integrations/myinvois";

const businessId = "10000000-0000-4000-8000-000000000001";
const connection: MyInvoisConnectionRecord = {
  id: "20000000-0000-4000-8000-000000000001", businessId, environment: "sandbox", authMode: "intermediary",
  taxpayerTin: "C1234567890", taxpayerRegistrationScheme: "ROB", taxpayerRegistrationValue: "202401234567",
  onbehalfofValue: "C1234567890:202401234567", credentialSetId: "sandbox", clientIdSecretRef: "client",
  clientSecretSecretRef: "secret", signingCertificateSecretRef: "certificate", signingPrivateKeySecretRef: "key",
  enabled: true, createdAt: "2026-07-18T00:00:00.000Z", updatedAt: "2026-07-18T00:00:00.000Z",
};

function candidate(index: number, overrides: Partial<EInvoiceSubmissionCandidate> = {}): EInvoiceSubmissionCandidate {
  const unsignedPayload = JSON.stringify({ Invoice: [{ InvoiceTypeCode: [{ _: "01", listVersionID: "1.0" }], ID: [{ _: `INV-${index}` }] }] });
  return {
    payloadSnapshotId: `30000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    businessId,
    eInvoiceDocumentId: `40000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    documentRevision: 1, documentVersion: "1.0", format: "json", unsignedPayload,
    unsignedPayloadHash: createHash("sha256").update(unsignedPayload).digest("hex"),
    invoiceCodeNumber: `INV-${index}`, approved: true, active: true, submissionEligible: true,
    ...overrides,
  };
}

class MemoryRepository implements EInvoiceSubmissionRepository {
  submissions: EInvoiceSubmissionRecord[] = [];
  candidates: EInvoiceSubmissionCandidate[];

  constructor(candidates: EInvoiceSubmissionCandidate[]) { this.candidates = candidates; }
  async listSubmissionCandidates() { return this.candidates; }
  async loadSubmissionCandidates(selectedBusinessId: string, ids: string[]) { return this.candidates.filter((item) => item.businessId === selectedBusinessId && ids.includes(item.payloadSnapshotId)); }
  async findConnection(selectedBusinessId: string) { return selectedBusinessId === businessId ? connection : null; }
  async findSubmissionByIdempotencyKey(selectedBusinessId: string, key: string) { return this.submissions.find((item) => item.businessId === selectedBusinessId && item.idempotencyKey === key) ?? null; }
  async createPendingSubmission(input: CreatePendingSubmissionInput) {
    const existing = await this.findSubmissionByIdempotencyKey(input.businessId, input.idempotencyKey);
    if (existing) return { record: existing, created: false };
    const record: EInvoiceSubmissionRecord = {
      id: `50000000-0000-4000-8000-${String(this.submissions.length + 1).padStart(12, "0")}`,
      businessId: input.businessId, environment: input.environment, idempotencyKey: input.idempotencyKey,
      requestHash: input.requestHash, status: "pending", requestedAt: input.requestedAt, retryCount: 0,
      documents: input.documents.map((item) => ({ ...item, submissionId: "pending", status: "submitted" })),
    };
    record.documents.forEach((item) => { item.submissionId = record.id; });
    this.submissions.push(record);
    return { record, created: true };
  }
  async recordSubmissionResponse(input: RecordSubmissionResponseInput) {
    const record = this.submissions.find((item) => item.id === input.submissionId)!;
    Object.assign(record, { status: input.status, respondedAt: input.respondedAt, httpStatus: input.httpStatus, correlationId: input.correlationId, submissionUid: input.submissionUid, retryAfter: input.retryAfter, retryCount: input.retryCount, errorCode: input.errorCode, errorMessage: input.errorMessage });
    for (const result of input.documents) Object.assign(record.documents.find((item) => item.invoiceCodeNumber === result.invoiceCodeNumber)!, result);
    return record;
  }
  async findSubmission(selectedBusinessId: string, submissionId: string) { return this.submissions.find((item) => item.businessId === selectedBusinessId && item.id === submissionId) ?? null; }
  async listSubmissions(selectedBusinessId: string) { return this.submissions.filter((item) => item.businessId === selectedBusinessId); }
  async listDueSubmissions() { return this.submissions.filter((item) => ["submitted", "processing"].includes(item.status)); }
  async reconcileSubmission(input: ReconcileSubmissionInput) {
    const record = this.submissions.find((item) => item.id === input.submissionId)!;
    record.status = input.status; record.retryAfter = input.retryAfter; record.retryCount += 1;
    for (const result of input.documents) Object.assign(record.documents.find((item) => item.invoiceCodeNumber === result.invoiceCodeNumber)!, result);
    return record;
  }
}

function transport(overrides: Partial<MyInvoisSubmissionTransport> = {}) {
  return {
    submit: vi.fn(), getSubmission: vi.fn(), getDocumentDetails: vi.fn(), ...overrides,
  } as unknown as MyInvoisSubmissionTransport;
}

describe("EInvoiceSubmissionService", () => {
  it("uses the exact unsigned v1.0 bytes for base64 and hash and persists partial acceptance independently", async () => {
    const candidates = [candidate(1), candidate(2)];
    const repository = new MemoryRepository(candidates);
    const submit = vi.fn().mockResolvedValue({
      httpStatus: 202, correlationId: "corr-1", rawResponse: { safe: true },
      data: { submissionUID: "SUBMISSION-1", acceptedDocuments: [{ uuid: "UUID-1", invoiceCodeNumber: "INV-1" }], rejectedDocuments: [{ invoiceCodeNumber: "INV-2", error: { errorCode: "BadStructure", message: "Invoice structure is invalid." } }] },
    });
    const service = new EInvoiceSubmissionService(repository, transport({ submit }));
    const result = await service.submit(businessId, "sandbox", candidates.map((item) => item.payloadSnapshotId), "2026-07-18T00:00:00.000Z");
    const request = JSON.parse(submit.mock.calls[0][1] as string) as { documents: Array<{ document: string; documentHash: string }> };
    expect(Buffer.from(request.documents[0].document, "base64").toString("utf8")).toBe(candidates[0].unsignedPayload);
    expect(request.documents[0].documentHash).toBe(createHash("sha256").update(candidates[0].unsignedPayload).digest("hex"));
    expect(result.status).toBe("submitted");
    expect(result.documents).toEqual(expect.arrayContaining([
      expect.objectContaining({ invoiceCodeNumber: "INV-1", accepted: true, status: "submitted", myinvoisUuid: "UUID-1" }),
      expect.objectContaining({ invoiceCodeNumber: "INV-2", accepted: false, status: "failed" }),
    ]));
  });

  it("returns the existing local attempt on a repeated click without another provider call", async () => {
    const selected = candidate(1);
    const repository = new MemoryRepository([selected]);
    const submit = vi.fn().mockResolvedValue({ httpStatus: 202, data: { submissionUID: "SUBMISSION-1", acceptedDocuments: [{ uuid: "UUID-1", invoiceCodeNumber: "INV-1" }], rejectedDocuments: [] } });
    const service = new EInvoiceSubmissionService(repository, transport({ submit }));
    const first = await service.submit(businessId, "sandbox", [selected.payloadSnapshotId], "2026-07-18T00:00:00.000Z");
    const second = await service.submit(businessId, "sandbox", [selected.payloadSnapshotId], "2026-07-18T00:00:01.000Z");
    expect(second.id).toBe(first.id);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("retries one transport failure but never retries a permission response", async () => {
    const selected = candidate(1);
    const retryingSubmit = vi.fn()
      .mockResolvedValueOnce({ httpStatus: 0, error: { errorCode: "transport_error", message: "Unavailable" } })
      .mockResolvedValueOnce({ httpStatus: 202, data: { submissionUID: "SUBMISSION-1", acceptedDocuments: [{ uuid: "UUID-1", invoiceCodeNumber: "INV-1" }], rejectedDocuments: [] } });
    const retried = await new EInvoiceSubmissionService(new MemoryRepository([selected]), transport({ submit: retryingSubmit }))
      .submit(businessId, "sandbox", [selected.payloadSnapshotId], "2026-07-18T00:00:00.000Z");
    expect(retryingSubmit).toHaveBeenCalledTimes(2);
    expect(retried.retryCount).toBe(1);

    const permissionSubmit = vi.fn().mockResolvedValue({ httpStatus: 403, error: { errorCode: "IncorrectSubmitter", message: "Permission denied" } });
    const denied = await new EInvoiceSubmissionService(new MemoryRepository([selected]), transport({ submit: permissionSubmit }))
      .submit(businessId, "sandbox", [selected.payloadSnapshotId], "2026-07-18T00:00:00.000Z");
    expect(permissionSubmit).toHaveBeenCalledTimes(1);
    expect(denied.status).toBe("failed");
  });

  it.each([
    ["unsigned hash mismatch", { unsignedPayloadHash: "0".repeat(64) }, "document.hash_mismatch"],
    ["superseded revision", { active: false }, "selection.not_submittable"],
    ["unsupported version", { documentVersion: "1.1" as const }, "selection.unsupported_version"],
    ["cross tenant", { businessId: "10000000-0000-4000-8000-000000000099" }, "selection.not_found"],
  ])("rejects %s before a network call", async (_label, override, code) => {
    const selected = candidate(1, override);
    const submit = vi.fn();
    const service = new EInvoiceSubmissionService(new MemoryRepository([selected]), transport({ submit }));
    await expect(service.submit(businessId, "sandbox", [selected.payloadSnapshotId], "2026-07-18T00:00:00.000Z"))
      .rejects.toMatchObject({ code });
    expect(submit).not.toHaveBeenCalled();
  });

  it("polls to terminal states and requests details only for an invalid document", async () => {
    const candidates = [candidate(1), candidate(2)];
    const repository = new MemoryRepository(candidates);
    const submit = vi.fn().mockResolvedValue({ httpStatus: 202, data: { submissionUID: "SUBMISSION-1", acceptedDocuments: candidates.map((item, index) => ({ uuid: `UUID-${index + 1}`, invoiceCodeNumber: item.invoiceCodeNumber })), rejectedDocuments: [] } });
    const getSubmission = vi.fn().mockResolvedValue({ httpStatus: 200, data: { submissionUid: "SUBMISSION-1", documentCount: 2, overallStatus: "partially valid", documentSummary: [
      { uuid: "UUID-1", internalId: "INV-1", longId: "LONG-1", status: "Valid" },
      { uuid: "UUID-2", internalId: "INV-2", longId: null, status: "Invalid" },
    ] } });
    const getDocumentDetails = vi.fn().mockResolvedValue({ httpStatus: 200, data: { uuid: "UUID-2", internalId: "INV-2", status: "Invalid", validationResults: { validationSteps: [{ name: "Tax", status: "Invalid" }] } } });
    const service = new EInvoiceSubmissionService(repository, transport({ submit, getSubmission, getDocumentDetails }));
    const submitted = await service.submit(businessId, "sandbox", candidates.map((item) => item.payloadSnapshotId), "2026-07-18T00:00:00.000Z");
    const reconciled = await service.refresh(businessId, submitted.id, "2026-07-18T00:00:05.000Z");
    expect(reconciled.status).toBe("completed");
    expect(reconciled.documents).toEqual(expect.arrayContaining([
      expect.objectContaining({ invoiceCodeNumber: "INV-1", status: "valid", longId: "LONG-1", shareUrl: expect.stringContaining("UUID-1/share/LONG-1") }),
      expect.objectContaining({ invoiceCodeNumber: "INV-2", status: "invalid", validationResult: expect.any(Object) }),
    ]));
    expect(getDocumentDetails).toHaveBeenCalledTimes(1);
    await service.refresh(businessId, submitted.id, "2026-07-18T00:00:10.000Z");
    expect(getSubmission).toHaveBeenCalledTimes(1);
  });
});
