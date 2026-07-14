import type {
  AuditableEntity,
  CurrencyCode,
  DecimalString,
  ExtractionRunId,
  ISODate,
  ISODateTime,
  MoneyValue,
  SourceDocumentId,
  UserId,
} from "../common";
import type { ExtractedField, JsonValue } from "./extracted-field";
import type { ExtractionWarning } from "./extraction-warning";

export type ExtractionStatus =
  | "pending"
  | "running"
  | "failed"
  | "extracted"
  | "needs_review"
  | "approved"
  | "rejected"
  | "superseded";

export interface ProposedTransactionLine {
  description?: string;
  quantity?: DecimalString;
  unitPrice?: MoneyValue;
  amount?: MoneyValue;
}

/** A permissive AI proposal. It is not a confirmed financial transaction. */
export interface ProposedTransaction {
  direction?: "income" | "expense" | "unknown";
  transactionDate?: ISODate;
  counterpartyName?: string;
  description?: string;
  category?: string;
  currency?: CurrencyCode;
  subtotal?: MoneyValue;
  tax?: MoneyValue;
  total?: MoneyValue;
  paymentMethod?: string;
  lineItems?: ProposedTransactionLine[];
}

export interface ReviewedFieldChange {
  fieldPath: string;
  originalValue: JsonValue;
  reviewedValue: JsonValue;
}

export interface ExtractionRun extends Omit<AuditableEntity, "id"> {
  id: ExtractionRunId;
  sourceDocumentId: SourceDocumentId;
  extractionVersion: string;
  provider: string;
  modelName: string;
  promptOrPipelineVersion: string;
  rawProviderResult: JsonValue;
  normalizedProposedResult?: ProposedTransaction;
  fields: ExtractedField[];
  warnings: ExtractionWarning[];
  overallConfidence?: number;
  status: ExtractionStatus;
  failureReason?: string;
  startedAt: ISODateTime;
  completedAt?: ISODateTime;
  reviewedBy?: UserId;
  reviewedAt?: ISODateTime;
  reviewerNotes?: string;
  changedFields: ReviewedFieldChange[];
  supersededByRunId?: ExtractionRunId;
}
