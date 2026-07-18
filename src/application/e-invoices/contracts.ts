import type { CommercialDocument, Party } from "@/domain";

export type EInvoiceScenario =
  | "b2b_invoice" | "consolidated_transaction" | "foreign_buyer" | "self_billed_invoice"
  | "credit_note" | "debit_note" | "refund_note" | "tax_exempt" | "foreign_currency"
  | "import_export" | "shipping_recipient";
export type EInvoicePreparationStatus = "needs_information" | "ready" | "approved";

export interface AssemblyDiagnostic {
  code: string;
  fieldPath: string;
  message: string;
  source: "business" | "party" | "invoice" | "invoice_line" | "calculated";
}

export type PreparationDiagnosticSeverity = "error" | "warning" | "derived" | "recommendation";
export type PreparationDiagnosticGroup = "supplier" | "buyer" | "document" | "line" | "tax" | "scenario";

export interface PreparationDiagnostic {
  code: string;
  fieldPath: string;
  message: string;
  severity: PreparationDiagnosticSeverity;
  group: PreparationDiagnosticGroup;
  sourceReferenceLabel: string;
}

export interface PreparationReadinessResult {
  ready: boolean;
  diagnostics: PreparationDiagnostic[];
  validatedAt: string;
  checkLabel: "NiagaAI internal preparation checks";
}

export interface AssemblyProvenanceEntry {
  canonicalPath: string;
  sourceTable: string;
  sourceColumn: string;
  sourceRecordId: string;
}

export interface SupplierSnapshot {
  party: Party;
  msicCode?: string;
  businessActivityDescription?: string;
}

export interface StoredAddressSource {
  addressLines: string[];
  city: string;
  postcode?: string;
  stateCode?: string;
  countryCode: string;
}

export interface StoredPartySource {
  id: string;
  kind: Party["kind"];
  legalName: string;
  tradingName?: string;
  roles: Party["roles"];
  taxIdentifiers: Party["taxIdentifiers"];
  registrationIdentifiers: Party["registrationIdentifiers"];
  email?: string;
  phone?: string;
  billingAddress?: StoredAddressSource;
  shippingAddress?: StoredAddressSource;
  defaultCurrency?: string;
  defaultPaymentTermsDays?: number;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface StoredBusinessSource {
  id: string;
  legalName: string;
  tradingName?: string;
  entityType: string;
  defaultCurrency: string;
  preferredLanguage: string;
  timezone: string;
  msicCode?: string;
  businessActivityDescription?: string;
  taxIdentifiers: Party["taxIdentifiers"];
  registrationIdentifiers: Party["registrationIdentifiers"];
  email?: string;
  phone?: string;
  address?: StoredAddressSource;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface StoredInvoiceLineSource {
  id: string;
  lineNumber: number;
  description: string;
  quantity: string;
  unitCode?: string;
  unitPriceMinor: number;
  discountMinor: number;
  chargeMinor: number;
  taxTypeCode: string;
  taxRate: string;
  classificationCode?: string;
  exemptionReason?: string;
  countryOfOrigin?: string;
  tariffCode?: string;
  itemMetadata: Record<string, unknown>;
}

export interface StoredInvoiceSource {
  id: string;
  businessId: string;
  documentType: CommercialDocument["documentType"];
  invoiceNumber: string;
  customerId?: string;
  shippingRecipientPartyId?: string;
  issueDate: string;
  issueTime?: string;
  dueDate?: string;
  currency: string;
  taxCurrency?: string;
  exchangeRate?: string;
  paymentModeCode?: string;
  bankAccountIdentifier?: string;
  paymentTerms?: string;
  paymentReference?: string;
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
  documentReferences: unknown;
  documentAllowances: unknown;
  documentCharges: unknown;
  prepaidMinor: number;
  invoicePurpose?: string;
  notes?: string;
  roundingMinor: number;
  supplementalFields: Record<string, unknown>;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  items: StoredInvoiceLineSource[];
}

export interface EInvoiceAssemblyBundle {
  business: StoredBusinessSource;
  invoice: StoredInvoiceSource;
  buyer?: StoredPartySource;
  shippingRecipient?: StoredPartySource;
}

export interface EInvoiceCandidate {
  id: string;
  invoiceNumber: string;
  documentType: CommercialDocument["documentType"];
  issueDate: string;
  currency: string;
  paymentStatus: string;
  revision: number;
  eligible: boolean;
  ineligibilityReasons: string[];
  preparationId?: string;
  preparationStatus?: EInvoicePreparationStatus;
}

export interface EInvoicePreparationRecord {
  id: string;
  businessId: string;
  sourceInvoiceId: string;
  sourceInvoiceRevision: number;
  documentType: CommercialDocument["documentType"];
  documentVersion: "1.0" | "unsupported_historical";
  scenario: EInvoiceScenario;
  canonicalDocument: CommercialDocument | null;
  supplierSnapshot: SupplierSnapshot | Record<string, unknown>;
  buyerSnapshot: Party | Record<string, unknown>;
  supplementalFields: Record<string, unknown>;
  provenance: AssemblyProvenanceEntry[];
  readinessResult: PreparationReadinessResult;
  status: EInvoicePreparationStatus;
  revision: number;
  approvedAt?: string;
  approvedBy?: string;
  supersedesDocumentId?: string;
  active: boolean;
  submissionEligible: boolean;
  createdAt: string;
  updatedAt: string;
}

export type EInvoicePreparationView = Pick<EInvoicePreparationRecord,
  "id" | "businessId" | "sourceInvoiceId" | "sourceInvoiceRevision" | "documentType" |
  "documentVersion" | "scenario" | "supplementalFields" | "readinessResult" | "status" |
  "revision" | "approvedAt" | "supersedesDocumentId" | "active" | "submissionEligible" |
  "createdAt" | "updatedAt"
> & { hasCanonicalDocument: boolean };

export interface CreateOrRefreshPreparationInput {
  businessId: string;
  sourceInvoiceId: string;
  sourceInvoiceRevision: number;
  documentType: CommercialDocument["documentType"];
  scenario: EInvoiceScenario;
  canonicalDocument: CommercialDocument | null;
  supplierSnapshot: SupplierSnapshot | Record<string, unknown>;
  buyerSnapshot: Party | Record<string, unknown>;
  supplementalFields: Record<string, unknown>;
  provenance: AssemblyProvenanceEntry[];
  diagnostics: AssemblyDiagnostic[];
  readinessResult?: PreparationReadinessResult;
}

export interface EInvoiceSourceRepository {
  loadAssemblyBundle(businessId: string, invoiceId: string): Promise<EInvoiceAssemblyBundle | null>;
}

export interface EInvoicePreparationRepository {
  listCandidates(businessId: string): Promise<EInvoiceCandidate[]>;
  listPreparations(businessId: string): Promise<EInvoicePreparationRecord[]>;
  createOrRefresh(input: CreateOrRefreshPreparationInput): Promise<EInvoicePreparationRecord>;
  findByBusinessAndId(businessId: string, documentId: string): Promise<EInvoicePreparationRecord | null>;
  saveSupplementalFields(businessId: string, documentId: string, expectedRevision: number, fields: Record<string, unknown>): Promise<EInvoicePreparationRecord>;
  replaceDraft(input: CreateOrRefreshPreparationInput & { documentId: string; expectedRevision: number; readinessResult: PreparationReadinessResult }): Promise<EInvoicePreparationRecord>;
  approveReadyRevision(businessId: string, documentId: string, expectedRevision: number, readinessResult: PreparationReadinessResult): Promise<EInvoicePreparationRecord>;
  createRevision(businessId: string, documentId: string): Promise<EInvoicePreparationRecord>;
}

export type EInvoicePayloadFormat = "json";

export interface EInvoicePayloadSnapshotRecord {
  id: string;
  businessId: string;
  eInvoiceDocumentId: string;
  documentRevision: number;
  documentVersion: "1.0";
  mapperVersion: string;
  referenceDataVersion: string;
  format: EInvoicePayloadFormat;
  /** Exact minified bytes represented as UTF-8 text. Never reconstruct from JSONB. */
  unsignedPayload: string;
  unsignedPayloadHash: string;
  payloadSizeBytes: number;
  generatedAt: string;
}

export type PersistEInvoicePayloadSnapshotInput = Omit<EInvoicePayloadSnapshotRecord, "id">;

export interface EInvoicePayloadSnapshotRepository {
  loadApprovedForGeneration(businessId: string, documentId: string): Promise<EInvoicePreparationRecord | null>;
  findExact(input: Pick<PersistEInvoicePayloadSnapshotInput,
    "businessId" | "eInvoiceDocumentId" | "documentRevision" | "documentVersion" |
    "mapperVersion" | "referenceDataVersion" | "format"
  >): Promise<EInvoicePayloadSnapshotRecord | null>;
  persistImmutable(input: PersistEInvoicePayloadSnapshotInput): Promise<EInvoicePayloadSnapshotRecord>;
}

export type MyInvoisEnvironment = "sandbox" | "production";
export type MyInvoisAuthMode = "taxpayer" | "intermediary";

export interface MyInvoisConnectionRecord {
  id: string;
  businessId: string;
  environment: MyInvoisEnvironment;
  authMode: MyInvoisAuthMode;
  taxpayerTin: string;
  taxpayerRegistrationScheme?: "ROB";
  taxpayerRegistrationValue?: string;
  onbehalfofValue: string;
  credentialSetId: string;
  clientIdSecretRef: string;
  clientSecretSecretRef: string;
  enabled: boolean;
  /** Production submission remains unsigned v1.0 until HASiL retires that version. */
  documentVersion: "1.0";
  verifiedAt?: string;
  verifiedBy?: string;
  sandboxVerifiedAt?: string;
  sandboxVerifiedBy?: string;
  productionActivatedAt?: string;
  productionActivatedBy?: string;
  productionDisabledAt?: string;
  productionDisabledBy?: string;
  productionActivationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export type PersistMyInvoisConnectionInput = Omit<
  MyInvoisConnectionRecord,
  "id" | "onbehalfofValue" | "verifiedAt" | "verifiedBy" |
  "documentVersion" | "sandboxVerifiedAt" | "sandboxVerifiedBy" |
  "productionActivatedAt" | "productionActivatedBy" | "productionDisabledAt" |
  "productionDisabledBy" | "productionActivationReason" |
  "createdAt" | "updatedAt"
>;

export interface EInvoiceConnectionRepository {
  findConnection(businessId: string, environment: MyInvoisEnvironment): Promise<MyInvoisConnectionRecord | null>;
  upsertConnection(input: PersistMyInvoisConnectionInput): Promise<MyInvoisConnectionRecord>;
  markConnectionVerified(connectionId: string, businessId: string, verifiedBy: string, verifiedAt: string): Promise<void>;
}

export type EInvoiceSubmissionStatus = "pending" | "submitted" | "processing" | "completed" | "failed" | "dead_letter";
export type EInvoiceDocumentSubmissionStatus = "submitted" | "processing" | "valid" | "invalid" | "cancelled" | "failed";

export interface EInvoiceSubmissionCandidate {
  payloadSnapshotId: string;
  businessId: string;
  eInvoiceDocumentId: string;
  documentRevision: number;
  documentVersion: "1.0";
  scenario: EInvoiceScenario;
  format: EInvoicePayloadFormat;
  unsignedPayload: string;
  unsignedPayloadHash: string;
  invoiceCodeNumber: string;
  approved: boolean;
  active: boolean;
  submissionEligible: boolean;
}

export interface MyInvoisStructuredError {
  propertyName?: string;
  propertyPath?: string;
  errorCode?: string;
  message: string;
  innerErrors?: MyInvoisStructuredError[];
}

export interface EInvoiceSubmissionDocumentRecord {
  submissionId: string;
  eInvoiceDocumentId: string;
  payloadSnapshotId: string;
  invoiceCodeNumber: string;
  accepted?: boolean;
  status: EInvoiceDocumentSubmissionStatus;
  myinvoisUuid?: string;
  longId?: string;
  shareUrl?: string;
  rejectionError?: MyInvoisStructuredError;
  validationResult?: unknown;
  cancellationEligibleUntil?: string;
}

export interface EInvoiceSubmissionRecord {
  id: string;
  businessId: string;
  environment: MyInvoisEnvironment;
  idempotencyKey: string;
  requestHash: string;
  submissionUid?: string;
  status: EInvoiceSubmissionStatus;
  requestedAt: string;
  respondedAt?: string;
  httpStatus?: number;
  correlationId?: string;
  retryCount: number;
  retryAfter?: string;
  errorCode?: string;
  errorMessage?: string;
  leaseOwner?: string;
  leaseExpiresAt?: string;
  deadLetteredAt?: string;
  deadLetterReason?: string;
  documents: EInvoiceSubmissionDocumentRecord[];
}

export type EInvoiceSubmissionHistoryFilter = "all" | "attention" | "in_progress" | "completed";

export interface EInvoiceSubmissionHistoryPage {
  submissions: EInvoiceSubmissionRecord[];
  nextCursor?: string;
}

export interface CreatePendingSubmissionInput {
  businessId: string;
  environment: MyInvoisEnvironment;
  idempotencyKey: string;
  requestHash: string;
  requestedAt: string;
  documents: Array<Pick<EInvoiceSubmissionDocumentRecord,
    "eInvoiceDocumentId" | "payloadSnapshotId" | "invoiceCodeNumber"
  >>;
}

export interface RecordSubmissionResponseInput {
  submissionId: string;
  businessId: string;
  status: EInvoiceSubmissionStatus;
  respondedAt: string;
  httpStatus?: number;
  correlationId?: string;
  submissionUid?: string;
  retryAfter?: string;
  errorCode?: string;
  errorMessage?: string;
  rawResponse?: unknown;
  retryCount: number;
  documents: Array<Pick<EInvoiceSubmissionDocumentRecord,
    "invoiceCodeNumber" | "accepted" | "status" | "myinvoisUuid" | "rejectionError"
  >>;
}

export interface ReconcileSubmissionInput {
  submissionId: string;
  businessId: string;
  status: EInvoiceSubmissionStatus;
  checkedAt: string;
  retryAfter?: string;
  documents: Array<Pick<EInvoiceSubmissionDocumentRecord,
    "invoiceCodeNumber" | "status" | "myinvoisUuid" | "longId" | "shareUrl" |
    "validationResult" | "cancellationEligibleUntil"
  >>;
}

export interface CancelEInvoiceDocumentInput {
  businessId: string;
  submissionId: string;
  eInvoiceDocumentId: string;
  reason: string;
  cancelledAt: string;
  correlationId?: string;
  rawResponse?: unknown;
}

export interface EInvoiceSubmissionRepository {
  listSubmissionCandidates(businessId: string, environment: MyInvoisEnvironment): Promise<EInvoiceSubmissionCandidate[]>;
  listAttemptedPayloadSnapshotIds(businessId: string, environment: MyInvoisEnvironment): Promise<string[]>;
  loadSubmissionCandidates(businessId: string, payloadSnapshotIds: string[]): Promise<EInvoiceSubmissionCandidate[]>;
  findConnection(businessId: string, environment: MyInvoisEnvironment): Promise<MyInvoisConnectionRecord | null>;
  reserveProviderCall(businessId: string, connection: MyInvoisConnectionRecord, endpoint: "submit" | "get_submission" | "get_document_details" | "cancel", limit: number, at: string): Promise<boolean>;
  findSubmissionByIdempotencyKey(businessId: string, idempotencyKey: string): Promise<EInvoiceSubmissionRecord | null>;
  createPendingSubmission(input: CreatePendingSubmissionInput): Promise<{ record: EInvoiceSubmissionRecord; created: boolean }>;
  recordSubmissionResponse(input: RecordSubmissionResponseInput): Promise<EInvoiceSubmissionRecord>;
  findSubmission(businessId: string, submissionId: string): Promise<EInvoiceSubmissionRecord | null>;
  listSubmissions(businessId: string): Promise<EInvoiceSubmissionRecord[]>;
  listSubmissionHistory(input: { businessId: string; environment: MyInvoisEnvironment; filter: EInvoiceSubmissionHistoryFilter; cursor?: string; limit: number }): Promise<EInvoiceSubmissionHistoryPage>;
  listSubmissionAttention(businessId: string, environment: MyInvoisEnvironment): Promise<EInvoiceSubmissionRecord[]>;
  claimDueSubmissions(workerId: string, limit: number, at: string): Promise<EInvoiceSubmissionRecord[]>;
  recordWorkerFailure(businessId: string, submissionId: string, workerId: string, reason: string, at: string): Promise<void>;
  recordWorkerSuccess(businessId: string, submissionId: string, workerId: string): Promise<void>;
  reconcileSubmission(input: ReconcileSubmissionInput): Promise<EInvoiceSubmissionRecord>;
  claimCancellation(input: Pick<CancelEInvoiceDocumentInput, "businessId" | "submissionId" | "eInvoiceDocumentId" | "reason" | "cancelledAt">): Promise<boolean>;
  recordCancellationFailure(input: Pick<CancelEInvoiceDocumentInput, "businessId" | "submissionId" | "eInvoiceDocumentId" | "cancelledAt"> & { errorSummary: string }): Promise<void>;
  recordCancellation(input: CancelEInvoiceDocumentInput): Promise<EInvoiceSubmissionRecord>;
}
