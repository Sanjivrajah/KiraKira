import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreatePendingSubmissionInput,
  EInvoiceSubmissionCandidate,
  EInvoiceSubmissionDocumentRecord,
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

  async loadSubmissionCandidates(businessId: string, payloadSnapshotIds: string[]): Promise<EInvoiceSubmissionCandidate[]> {
    const payloadResult = await this.client.from("e_invoice_payload_snapshots")
      .select("id,business_id,e_invoice_document_id,document_revision,document_version,format,unsigned_payload,unsigned_payload_hash")
      .eq("business_id", businessId).eq("document_version", "1.0").in("id", payloadSnapshotIds);
    if (payloadResult.error) throw payloadResult.error;
    const payloadRows = payloadResult.data as Array<{ id: string; business_id: string; e_invoice_document_id: string; document_revision: number; document_version: "1.0"; format: string; unsigned_payload: string; unsigned_payload_hash: string }>;
    if (!payloadRows.length) return [];
    const documentResult = await this.client.from("e_invoice_documents").select("id,business_id,status,active,submission_eligible,revision,source_invoice_id").eq("business_id", businessId).in("id", payloadRows.map((row) => row.e_invoice_document_id));
    if (documentResult.error) throw documentResult.error;
    const documentRows = documentResult.data as Array<{ id: string; business_id: string; status: string; active: boolean; submission_eligible: boolean; revision: number; source_invoice_id: string }>;
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

  async findSubmissionByIdempotencyKey(businessId: string, idempotencyKey: string) {
    const { data, error } = await this.client.from("e_invoice_submissions").select().eq("business_id", businessId).eq("idempotency_key", idempotencyKey).maybeSingle();
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
    const { data, error } = await this.client.from("e_invoice_submissions").select().eq("business_id", businessId).eq("id", submissionId).maybeSingle();
    if (error) throw error;
    return data ? this.withDocuments(data as SubmissionRow) : null;
  }

  async listSubmissions(businessId: string) {
    const { data, error } = await this.client.from("e_invoice_submissions").select().eq("business_id", businessId).order("requested_at", { ascending: false });
    if (error) throw error;
    return this.rowsWithDocuments(data as SubmissionRow[]);
  }

  async listDueSubmissions(limit: number, at: string) {
    const { data, error } = await this.client.from("e_invoice_submissions").select().in("status", ["submitted", "processing"])
      .lte("retry_after", at).order("retry_after", { ascending: true }).limit(limit);
    if (error) throw error;
    return this.rowsWithDocuments(data as SubmissionRow[]);
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
