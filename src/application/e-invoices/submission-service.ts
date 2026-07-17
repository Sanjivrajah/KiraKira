import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import type {
  EInvoiceDocumentSubmissionStatus,
  EInvoiceSubmissionRecord,
  EInvoiceSubmissionRepository,
  MyInvoisEnvironment,
  MyInvoisStructuredError,
} from "./contracts";
import type { MyInvoisSubmissionTransport } from "@/integrations/myinvois";

const MAX_DOCUMENTS = 100;
const MAX_DOCUMENT_BYTES = 300 * 1024;
const MAX_REQUEST_BYTES = 5 * 1024 * 1024;
const TERMINAL_DOCUMENT_STATUSES = new Set<EInvoiceDocumentSubmissionStatus>(["valid", "invalid", "cancelled", "failed"]);

export class EInvoiceSubmissionServiceError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "EInvoiceSubmissionServiceError";
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function providerStatus(value: string): EInvoiceDocumentSubmissionStatus {
  switch (value.trim().toLowerCase()) {
    case "valid": return "valid";
    case "invalid": return "invalid";
    case "cancelled": return "cancelled";
    case "submitted": return "submitted";
    default: return "processing";
  }
}

function errorCode(error?: MyInvoisStructuredError): string | undefined {
  return error?.errorCode ?? error?.innerErrors?.find((item) => item.errorCode)?.errorCode;
}

function retryAt(now: string, seconds?: number): string | undefined {
  return seconds === undefined ? undefined : new Date(new Date(now).valueOf() + seconds * 1000).toISOString();
}

function cancellationDeadline(receivedAt: string): string {
  return new Date(new Date(receivedAt).valueOf() + 72 * 60 * 60 * 1000).toISOString();
}

export interface EInvoiceSubmissionPreview {
  documentCount: number;
  encodedSizeBytes: number;
  requestSizeBytes: number;
  environment: MyInvoisEnvironment;
  taxpayerIdentity: string;
}

export class EInvoiceSubmissionService {
  constructor(
    private readonly repository: EInvoiceSubmissionRepository,
    private readonly transport: MyInvoisSubmissionTransport,
    private readonly portalBaseUrls: Record<MyInvoisEnvironment, string> = {
      sandbox: "https://preprod.myinvois.hasil.gov.my",
      production: "https://myinvois.hasil.gov.my",
    },
  ) {}

  async preview(businessId: string, environment: MyInvoisEnvironment, payloadSnapshotIds: string[]): Promise<EInvoiceSubmissionPreview> {
    const prepared = await this.prepare(businessId, environment, payloadSnapshotIds);
    return {
      documentCount: prepared.candidates.length,
      encodedSizeBytes: prepared.candidates.reduce((sum, item) => sum + Buffer.byteLength(Buffer.from(item.unsignedPayload, "utf8").toString("base64"), "utf8"), 0),
      requestSizeBytes: Buffer.byteLength(prepared.requestBody, "utf8"),
      environment,
      taxpayerIdentity: prepared.connection.onbehalfofValue,
    };
  }

  async submit(businessId: string, environment: MyInvoisEnvironment, payloadSnapshotIds: string[], requestedAt: string): Promise<EInvoiceSubmissionRecord> {
    if (environment !== "sandbox") throw new EInvoiceSubmissionServiceError("environment.not_sandbox", "Stage 5 allows sandbox submissions only.");
    const prepared = await this.prepare(businessId, environment, payloadSnapshotIds);
    const existing = await this.repository.findSubmissionByIdempotencyKey(businessId, prepared.idempotencyKey);
    if (existing) return existing;
    const claimed = await this.repository.createPendingSubmission({
      businessId,
      environment,
      idempotencyKey: prepared.idempotencyKey,
      requestHash: prepared.requestHash,
      requestedAt,
      documents: prepared.candidates.map((item) => ({ eInvoiceDocumentId: item.eInvoiceDocumentId, payloadSnapshotId: item.payloadSnapshotId, invoiceCodeNumber: item.invoiceCodeNumber })),
    });
    // The unique database key closes the race between the lookup and insert.
    if (!claimed.created) return claimed.record;
    const pending = claimed.record;

    let response = await this.transport.submit(prepared.connection, prepared.requestBody);
    let retryCount = 0;
    if (response.retryAfterSeconds === undefined && (response.httpStatus === 0 || [500, 502, 503, 504].includes(response.httpStatus))) {
      retryCount = 1;
      response = await this.transport.submit(prepared.connection, prepared.requestBody);
    }
    const accepted = new Map(response.data?.acceptedDocuments.map((item) => [item.invoiceCodeNumber, item]) ?? []);
    const rejected = new Map(response.data?.rejectedDocuments.map((item) => [item.invoiceCodeNumber, item]) ?? []);
    const succeeded = response.httpStatus === 202 && Boolean(response.data);
    const retryAfter = retryAt(requestedAt, response.retryAfterSeconds);
    return this.repository.recordSubmissionResponse({
      submissionId: pending.id,
      businessId,
      status: succeeded ? "submitted" : "failed",
      respondedAt: new Date().toISOString(),
      httpStatus: response.httpStatus || undefined,
      correlationId: response.correlationId,
      submissionUid: response.data?.submissionUID,
      retryAfter,
      errorCode: succeeded ? undefined : errorCode(response.error) ?? (response.httpStatus === 422 ? "DuplicateSubmission" : "submission_failed"),
      errorMessage: succeeded ? undefined : response.error?.message,
      rawResponse: response.rawResponse,
      retryCount,
      documents: prepared.candidates.map((item) => {
        const acceptedDocument = accepted.get(item.invoiceCodeNumber);
        const rejectedDocument = rejected.get(item.invoiceCodeNumber);
        return {
          invoiceCodeNumber: item.invoiceCodeNumber,
          accepted: acceptedDocument ? true : rejectedDocument ? false : undefined,
          status: acceptedDocument ? "submitted" : "failed",
          myinvoisUuid: acceptedDocument?.uuid,
          rejectionError: rejectedDocument?.error ?? (!succeeded ? response.error : undefined),
        };
      }),
    });
  }

  async refresh(businessId: string, submissionId: string, checkedAt: string): Promise<EInvoiceSubmissionRecord> {
    const submission = await this.repository.findSubmission(businessId, submissionId);
    if (!submission) throw new EInvoiceSubmissionServiceError("submission.not_found", "The sandbox submission was not found.");
    if (!submission.submissionUid || submission.status === "failed") return submission;
    if (submission.documents.every((item) => TERMINAL_DOCUMENT_STATUSES.has(item.status))) return submission;
    const connection = await this.repository.findConnection(businessId, submission.environment);
    if (!connection || !connection.enabled) throw new EInvoiceSubmissionServiceError("connection.not_found", "The MyInvois connection is unavailable for status refresh.");
    const response = await this.transport.getSubmission(connection, submission.submissionUid);
    if (!response.data) {
      return this.repository.reconcileSubmission({
        submissionId,
        businessId,
        status: "processing",
        checkedAt,
        retryAfter: retryAt(checkedAt, response.retryAfterSeconds ?? 5),
        documents: [],
      });
    }
    const summaries = new Map(response.data.documentSummary.map((item) => [item.internalId, item]));
    const documents = await Promise.all(submission.documents.map(async (item) => {
      const summary = summaries.get(item.invoiceCodeNumber);
      if (!summary || TERMINAL_DOCUMENT_STATUSES.has(item.status)) return { invoiceCodeNumber: item.invoiceCodeNumber, status: item.status };
      const status = providerStatus(summary.status);
      let validationResult: unknown;
      if (status === "invalid") {
        const details = await this.transport.getDocumentDetails(connection, summary.uuid);
        validationResult = details.data?.validationResults ?? details.error;
      }
      const longId = summary.longId ?? undefined;
      return {
        invoiceCodeNumber: item.invoiceCodeNumber,
        status,
        myinvoisUuid: summary.uuid,
        longId,
        shareUrl: status === "valid" && longId
          ? new URL(`/${encodeURIComponent(summary.uuid)}/share/${encodeURIComponent(longId)}`, this.portalBaseUrls[submission.environment]).toString()
          : undefined,
        validationResult,
        cancellationEligibleUntil: status === "valid" ? cancellationDeadline(checkedAt) : undefined,
      };
    }));
    const mergedStatuses = submission.documents.map((current) => documents.find((item) => item.invoiceCodeNumber === current.invoiceCodeNumber)?.status ?? current.status);
    const complete = mergedStatuses.every((status) => TERMINAL_DOCUMENT_STATUSES.has(status));
    return this.repository.reconcileSubmission({
      submissionId,
      businessId,
      status: complete ? "completed" : "processing",
      checkedAt,
      retryAfter: complete ? undefined : retryAt(checkedAt, response.retryAfterSeconds ?? 5),
      documents,
    });
  }

  async runDue(at: string, limit = 25): Promise<EInvoiceSubmissionRecord[]> {
    const due = await this.repository.listDueSubmissions(limit, at);
    return Promise.all(due.map((submission) => this.refresh(submission.businessId, submission.id, at)));
  }

  private async prepare(businessId: string, environment: MyInvoisEnvironment, payloadSnapshotIds: string[]) {
    const selectedIds = [...new Set(payloadSnapshotIds)].sort();
    if (!selectedIds.length) throw new EInvoiceSubmissionServiceError("selection.empty", "Select at least one v1.0 payload.");
    if (selectedIds.length > MAX_DOCUMENTS) throw new EInvoiceSubmissionServiceError("selection.too_many", `A submission can contain at most ${MAX_DOCUMENTS} documents.`);
    const [candidates, connection] = await Promise.all([
      this.repository.loadSubmissionCandidates(businessId, selectedIds),
      this.repository.findConnection(businessId, environment),
    ]);
    if (candidates.length !== selectedIds.length) throw new EInvoiceSubmissionServiceError("selection.not_found", "One or more v1.0 payloads are unavailable for this business.");
    if (!connection || !connection.enabled) throw new EInvoiceSubmissionServiceError("connection.not_found", `No enabled ${environment} MyInvois connection is configured.`);
    const byId = new Map(candidates.map((item) => [item.payloadSnapshotId, item]));
    const ordered = selectedIds.map((id) => byId.get(id)).filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (ordered.some((item) => item.businessId !== businessId)) throw new EInvoiceSubmissionServiceError("selection.cross_tenant", "Documents from another business cannot be submitted.");
    if (ordered.some((item) => item.documentVersion !== "1.0")) throw new EInvoiceSubmissionServiceError("selection.unsupported_version", "Sandbox submission requires unsigned MyInvois v1.0 payloads.");
    if (new Set(ordered.map((item) => item.format)).size !== 1) throw new EInvoiceSubmissionServiceError("selection.mixed_format", "All documents in a submission must use the same format.");
    if (ordered.some((item) => !item.approved || !item.active || !item.submissionEligible || item.documentRevision < 1)) throw new EInvoiceSubmissionServiceError("selection.not_submittable", "Every document must be the active approved, submission-eligible revision.");
    if (new Set(ordered.map((item) => item.invoiceCodeNumber)).size !== ordered.length) throw new EInvoiceSubmissionServiceError("selection.duplicate_code", "Invoice code numbers must be unique within a submission.");
    for (const item of ordered) {
      const size = Buffer.byteLength(item.unsignedPayload, "utf8");
      if (size > MAX_DOCUMENT_BYTES) throw new EInvoiceSubmissionServiceError("document.too_large", `${item.invoiceCodeNumber} exceeds the 300 KB document limit.`);
      if (sha256(item.unsignedPayload) !== item.unsignedPayloadHash) throw new EInvoiceSubmissionServiceError("document.hash_mismatch", `${item.invoiceCodeNumber} no longer matches its immutable payload hash.`);
    }
    const requestBody = JSON.stringify({ documents: ordered.map((item) => ({
      format: item.format.toUpperCase(),
      document: Buffer.from(item.unsignedPayload, "utf8").toString("base64"),
      documentHash: item.unsignedPayloadHash,
      codeNumber: item.invoiceCodeNumber,
    })) });
    if (Buffer.byteLength(requestBody, "utf8") > MAX_REQUEST_BYTES) throw new EInvoiceSubmissionServiceError("submission.too_large", "The encoded submission exceeds the 5 MB request limit.");
    const requestHash = sha256(requestBody);
    const idempotencyKey = sha256(JSON.stringify({ businessId, environment, payloadSnapshotIds: selectedIds, requestHash }));
    return { candidates: ordered, connection, requestBody, requestHash, idempotencyKey };
  }
}
