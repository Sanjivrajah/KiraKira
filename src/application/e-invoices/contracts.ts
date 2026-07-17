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
  documentVersion: "1.1";
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
