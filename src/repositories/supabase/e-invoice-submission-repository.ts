import { Buffer } from "node:buffer";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreatePendingSubmissionInput,
  EInvoiceSubmissionCandidate,
  EInvoiceSubmissionDocumentRecord,
  EInvoiceSubmissionHistoryFilter,
  EInvoiceSubmissionHistoryPage,
  EInvoiceSubmissionRecord,
  EInvoiceSubmissionRepository,
  MyInvoisConnectionRecord,
  MyInvoisEnvironment,
  ReconcileSubmissionInput,
  RecordSubmissionResponseInput,
} from "@/application/e-invoices";

interface SubmissionRow {
  id: string;
  business_id: string;
  environment: string;
  idempotency_key: string;
  request_hash: string;
  submission_uid: string | null;
  status: string;
  requested_at: string;
  responded_at: string | null;
  http_status: number | null;
  correlation_id: string | null;
  retry_count: number;
  retry_after: string | null;
  error_code: string | null;
  error_message: string | null;
  lease_owner: string | null;
  lease_expires_at: string | null;
  dead_lettered_at: string | null;
  dead_letter_reason: string | null;
}

interface SubmissionDocumentRow {
  submission_id: string;
  e_invoice_document_id: string;
  payload_snapshot_id: string;
  invoice_code_number: string;
  accepted: boolean | null;
  status: string;
  myinvois_uuid: string | null;
  long_id: string | null;
  share_url: string | null;
  rejection_error: unknown;
  validation_result: unknown;
  cancellation_eligible_until: string | null;
}

const submissionSelection = "id,business_id,environment,idempotency_key,request_hash,submission_uid,status,requested_at,responded_at,http_status,correlation_id,retry_count,retry_after,error_code,error_message,lease_owner,lease_expires_at,dead_lettered_at,dead_letter_reason";

function encodeCursor(row: Pick<SubmissionRow, "id" | "requested_at">): string {
  return Buffer.from(JSON.stringify({ id: row.id, requestedAt: row.requested_at }), "utf8").toString("base64url");
}

function decodeCursor(cursor: string): { id: string; requestedAt: string } | null {
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { id?: unknown; requestedAt?: unknown };
    return typeof value.id === "string" && typeof value.requestedAt === "string" && !Number.isNaN(new Date(value.requestedAt).valueOf())
      ? { id: value.id, requestedAt: value.requestedAt }
      : null;
  } catch {
    return null;
  }
}

function document(row: SubmissionDocumentRow): EInvoiceSubmissionDocumentRecord {
  return {
    submissionId: row.submission_id,
    eInvoiceDocumentId: row.e_invoice_document_id,
    payloadSnapshotId: row.payload_snapshot_id,
    invoiceCodeNumber: row.invoice_code_number,
    accepted: row.accepted ?? undefined,
    status: row.status as EInvoiceSubmissionDocumentRecord["status"],
    myinvoisUuid: row.myinvois_uuid ?? undefined,
    longId: row.long_id ?? undefined,
    shareUrl: row.share_url ?? undefined,
    rejectionError: row.rejection_error as EInvoiceSubmissionDocumentRecord["rejectionError"],
    validationResult: row.validation_result ?? undefined,
    cancellationEligibleUntil: row.cancellation_eligible_until ?? undefined,
  };
}

function submission(row: SubmissionRow, documents: SubmissionDocumentRow[]): EInvoiceSubmissionRecord {
  return {
    id: row.id,
    businessId: row.business_id,
    environment: row.environment as MyInvoisEnvironment,
    idempotencyKey: row.idempotency_key,
    requestHash: row.request_hash,
    submissionUid: row.submission_uid ?? undefined,
    status: row.status as EInvoiceSubmissionRecord["status"],
    requestedAt: row.requested_at,
    respondedAt: row.responded_at ?? undefined,
    httpStatus: row.http_status ?? undefined,
    correlationId: row.correlation_id ?? undefined,
    retryCount: row.retry_count,
    retryAfter: row.retry_after ?? undefined,
    errorCode: row.error_code ?? undefined,
    errorMessage: row.error_message ?? undefined,
    leaseOwner: row.lease_owner ?? undefined,
    leaseExpiresAt: row.lease_expires_at ?? undefined,
    deadLetteredAt: row.dead_lettered_at ?? undefined,
    deadLetterReason: row.dead_letter_reason ?? undefined,
    documents: documents.filter((item) => item.submission_id === row.id).map(document),
  };
}

/** Submission adapter is separate because its history is only mutated through audited database functions. */
export class SupabaseEInvoiceSubmissionRepository implements EInvoiceSubmissionRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listSubmissionCandidates(businessId: string, environment: MyInvoisEnvironment) {
    void environment; // v1.0 payload snapshots are environment-neutral; the connection selects sandbox at submit time.
    const { data, error } = await this.client.from("e_invoice_payload_snapshots").select("id")
      .eq("business_id", businessId).eq("document_version", "1.0").order("generated_at", { ascending: false }).limit(100);
    if (error) throw error;
    return this.loadSubmissionCandidates(businessId, (data as Array<{ id: string }>).map((row) => row.id));
  }

  async listAttemptedPayloadSnapshotIds(businessId: string, environment: MyInvoisEnvironment) {
    const { data: submissions, error: submissionError } = await this.client.from("e_invoice_submissions")
      .select("id").eq("business_id", businessId).eq("environment", environment);
    if (submissionError) throw submissionError;
    const ids = (submissions ?? []).map((item) => (item as { id: string }).id);
    if (!ids.length) return [];
    const { data, error } = await this.client.from("e_invoice_submission_documents")
      .select("payload_snapshot_id").in("submission_id", ids);
    if (error) throw error;
    return [...new Set((data ?? []).map((item) => (item as { payload_snapshot_id: string }).payload_snapshot_id))];
  }

  async loadSubmissionCandidates(businessId: string, payloadSnapshotIds: string[]): Promise<EInvoiceSubmissionCandidate[]> {
    const payloadResult = await this.client.from("e_invoice_payload_snapshots")
      .select("id,business_id,e_invoice_document_id,document_revision,document_version,format,unsigned_payload,unsigned_payload_hash")
      .eq("business_id", businessId).eq("document_version", "1.0").in("id", payloadSnapshotIds);
    if (payloadResult.error) throw payloadResult.error;
    const payloadRows = payloadResult.data as Array<{ id: string; business_id: string; e_invoice_document_id: string; document_revision: number; document_version: "1.0"; format: string; unsigned_payload: string; unsigned_payload_hash: string }>;
    if (!payloadRows.length) return [];
    const documentResult = await this.client.from("e_invoice_documents").select("id,business_id,status,active,submission_eligible,revision,source_invoice_id,scenario").eq("business_id", businessId).in("id", payloadRows.map((row) => row.e_invoice_document_id));
    if (documentResult.error) throw documentResult.error;
    const documentRows = documentResult.data as Array<{ id: string; business_id: string; status: string; active: boolean; submission_eligible: boolean; revision: number; source_invoice_id: string; scenario: EInvoiceSubmissionCandidate["scenario"] }>;
    const invoiceResult = await this.client.from("invoices").select("id,invoice_number").eq("business_id", businessId).in("id", documentRows.map((row) => row.source_invoice_id));
    if (invoiceResult.error) throw invoiceResult.error;
    const invoiceRows = invoiceResult.data as Array<{ id: string; invoice_number: string }>;
    const documentById = new Map(documentRows.map((row) => [row.id, row]));
    const invoiceById = new Map(invoiceRows.map((row) => [row.id, row]));
    return payloadRows.flatMap((payload) => {
      const source = documentById.get(payload.e_invoice_document_id);
      const invoice = source ? invoiceById.get(source.source_invoice_id) : undefined;
      if (!payload || !source || !invoice) return [];
      return [{
        payloadSnapshotId: payload.id, businessId: payload.business_id,
        eInvoiceDocumentId: source.id, documentRevision: payload.document_revision,
        documentVersion: payload.document_version,
        scenario: source.scenario,
        format: payload.format as "json", unsignedPayload: payload.unsigned_payload,
        unsignedPayloadHash: payload.unsigned_payload_hash, invoiceCodeNumber: invoice.invoice_number,
        approved: source.status === "approved", active: source.active,
        submissionEligible: source.submission_eligible && source.revision === payload.document_revision,
      }];
    });
  }

  async findConnection(businessId: string, environment: MyInvoisEnvironment): Promise<MyInvoisConnectionRecord | null> {
    const { SupabaseEInvoiceRepository } = await import("./e-invoice-repository");
    return new SupabaseEInvoiceRepository(this.client).findConnection(businessId, environment);
  }

  async reserveProviderCall(businessId: string, connection: MyInvoisConnectionRecord, endpoint: "submit" | "get_submission" | "get_document_details" | "cancel", limit: number, at: string) {
    const { data, error } = await this.client.rpc("reserve_e_invoice_provider_call", {
      p_business_id: businessId, p_credential_set_id: connection.credentialSetId,
      p_environment: connection.environment, p_endpoint: endpoint, p_limit: limit, p_at: at,
    });
    if (error) throw error;
    return data === true;
  }

  async findSubmissionByIdempotencyKey(businessId: string, idempotencyKey: string) {
    const { data, error } = await this.client.from("e_invoice_submissions").select(submissionSelection).eq("business_id", businessId).eq("idempotency_key", idempotencyKey).maybeSingle();
    if (error) throw error;
    return data ? this.withDocuments(data as SubmissionRow) : null;
  }

  async createPendingSubmission(input: CreatePendingSubmissionInput) {
    const { data, error } = await this.client.rpc("create_e_invoice_pending_submission", {
      p_business_id: input.businessId, p_environment: input.environment,
      p_idempotency_key: input.idempotencyKey, p_request_hash: input.requestHash,
      p_requested_at: input.requestedAt, p_documents: input.documents,
    });
    if (error) throw error;
    const claim = data as { id: string; created: boolean };
    const result = await this.findSubmission(input.businessId, claim.id);
    if (!result) throw new Error("The pending e-Invoice submission could not be reloaded.");
    return { record: result, created: claim.created };
  }

  async recordSubmissionResponse(input: RecordSubmissionResponseInput) {
    const { error } = await this.client.rpc("record_e_invoice_submission_response", {
      p_business_id: input.businessId, p_submission_id: input.submissionId, p_response: input,
    });
    if (error) throw error;
    const result = await this.findSubmission(input.businessId, input.submissionId);
    if (!result) throw new Error("The e-Invoice submission response could not be reloaded.");
    return result;
  }

  async findSubmission(businessId: string, submissionId: string) {
    const { data, error } = await this.client.from("e_invoice_submissions").select(submissionSelection).eq("business_id", businessId).eq("id", submissionId).maybeSingle();
    if (error) throw error;
    return data ? this.withDocuments(data as SubmissionRow) : null;
  }

  async listSubmissions(businessId: string) {
    const { data, error } = await this.client.from("e_invoice_submissions").select(submissionSelection).eq("business_id", businessId).order("requested_at", { ascending: false });
    if (error) throw error;
    return this.rowsWithDocuments(data as SubmissionRow[]);
  }

  async listSubmissionHistory(input: { businessId: string; environment: MyInvoisEnvironment; filter: EInvoiceSubmissionHistoryFilter; cursor?: string; limit: number }): Promise<EInvoiceSubmissionHistoryPage> {
    const statuses = input.filter === "attention"
      ? ["failed", "dead_letter"]
      : input.filter === "in_progress"
        ? ["pending", "submitted", "processing"]
        : input.filter === "completed"
          ? ["completed"]
          : undefined;
    const cursor = input.cursor ? decodeCursor(input.cursor) : undefined;
    let query = this.client.from("e_invoice_submissions").select(submissionSelection)
      .eq("business_id", input.businessId).eq("environment", input.environment)
      .order("requested_at", { ascending: false }).order("id", { ascending: false }).limit(input.limit + 1);
    if (statuses) query = query.in("status", statuses);
    if (cursor) query = query.or(`requested_at.lt.${cursor.requestedAt},and(requested_at.eq.${cursor.requestedAt},id.lt.${cursor.id})`);
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data ?? []) as SubmissionRow[];
    const hasMore = rows.length > input.limit;
    const pageRows = rows.slice(0, input.limit);
    const last = pageRows.at(-1);
    return {
      submissions: await this.rowsWithDocuments(pageRows),
      nextCursor: hasMore && last ? encodeCursor(last) : undefined,
    };
  }

  async listSubmissionAttention(businessId: string, environment: MyInvoisEnvironment) {
    const { data: documentData, error: documentError } = await this.client.from("e_invoice_submission_documents")
      .select().in("status", ["failed", "invalid"]).limit(100);
    if (documentError) throw documentError;
    const documents = (documentData ?? []) as SubmissionDocumentRow[];
    if (!documents.length) return [];
    const ids = [...new Set(documents.map((item) => item.submission_id))];
    const { data, error } = await this.client.from("e_invoice_submissions").select(submissionSelection)
      .eq("business_id", businessId).eq("environment", environment).in("id", ids)
      .order("requested_at", { ascending: false });
    if (error) throw error;
    const documentBySubmission = new Map<string, SubmissionDocumentRow[]>();
    for (const item of documents) documentBySubmission.set(item.submission_id, [...(documentBySubmission.get(item.submission_id) ?? []), item]);
    return ((data ?? []) as SubmissionRow[]).map((row) => submission(row, documentBySubmission.get(row.id) ?? []));
  }

  async claimDueSubmissions(workerId: string, limit: number, at: string) {
    const { data, error } = await this.client.rpc("claim_due_e_invoice_submissions", {
      p_worker_id: workerId, p_limit: limit, p_at: at, p_lease_seconds: 60,
    });
    if (error) throw error;
    return this.rowsWithDocuments((data ?? []) as SubmissionRow[]);
  }

  async recordWorkerFailure(businessId: string, submissionId: string, workerId: string, reason: string, at: string) {
    const { error } = await this.client.rpc("record_e_invoice_worker_failure", {
      p_business_id: businessId, p_submission_id: submissionId, p_worker_id: workerId,
      p_reason: reason, p_at: at,
    });
    if (error) throw error;
  }

  async recordWorkerSuccess(businessId: string, submissionId: string, workerId: string) {
    const { error } = await this.client.rpc("record_e_invoice_worker_success", {
      p_business_id: businessId, p_submission_id: submissionId, p_worker_id: workerId,
    });
    if (error) throw error;
  }

  async reconcileSubmission(input: ReconcileSubmissionInput) {
    const { error } = await this.client.rpc("reconcile_e_invoice_submission", {
      p_business_id: input.businessId, p_submission_id: input.submissionId,
      p_reconciliation: { ...input, source: "poll" },
    });
    if (error) throw error;
    const result = await this.findSubmission(input.businessId, input.submissionId);
    if (!result) throw new Error("The reconciled e-Invoice submission could not be reloaded.");
    return result;
  }

  async recordCancellation(input: import("@/application/e-invoices").CancelEInvoiceDocumentInput) {
    const { error } = await this.client.rpc("record_e_invoice_cancellation", {
      p_business_id: input.businessId, p_submission_id: input.submissionId,
      p_document_id: input.eInvoiceDocumentId, p_reason: input.reason,
      p_cancelled_at: input.cancelledAt, p_correlation_id: input.correlationId ?? null,
      p_raw_response: input.rawResponse ?? null,
    });
    if (error) throw error;
    const result = await this.findSubmission(input.businessId, input.submissionId);
    if (!result) throw new Error("The cancelled e-Invoice submission could not be reloaded.");
    return result;
  }

  async claimCancellation(input: Pick<import("@/application/e-invoices").CancelEInvoiceDocumentInput, "businessId" | "submissionId" | "eInvoiceDocumentId" | "reason" | "cancelledAt">) {
    const { data, error } = await this.client.rpc("claim_e_invoice_cancellation", {
      p_business_id: input.businessId, p_submission_id: input.submissionId,
      p_document_id: input.eInvoiceDocumentId, p_reason: input.reason, p_requested_at: input.cancelledAt,
    });
    if (error) throw error;
    return data === true;
  }

  async recordCancellationFailure(input: Pick<import("@/application/e-invoices").CancelEInvoiceDocumentInput, "businessId" | "submissionId" | "eInvoiceDocumentId" | "cancelledAt"> & { errorSummary: string }) {
    const { error } = await this.client.rpc("fail_e_invoice_cancellation", {
      p_business_id: input.businessId, p_submission_id: input.submissionId,
      p_document_id: input.eInvoiceDocumentId, p_reason: input.errorSummary, p_failed_at: input.cancelledAt,
    });
    if (error) throw error;
  }

  private async withDocuments(row: SubmissionRow) {
    const rows = await this.documentRows([row.id]);
    return submission(row, rows);
  }

  private async rowsWithDocuments(rows: SubmissionRow[]) {
    if (!rows.length) return [];
    const documents = await this.documentRows(rows.map((row) => row.id));
    return rows.map((row) => submission(row, documents));
  }

  private async documentRows(submissionIds: string[]) {
    const { data, error } = await this.client.from("e_invoice_submission_documents").select().in("submission_id", submissionIds).order("invoice_code_number");
    if (error) throw error;
    return data as SubmissionDocumentRow[];
  }
}
