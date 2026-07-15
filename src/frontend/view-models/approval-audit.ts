import {
  extractionRunSchema,
  type ExtractionRun,
  type FinancialTransaction,
  type ISODateTime,
  type JsonValue,
  type ReviewedFieldChange,
  type SourceDocument,
  type UserId,
} from "@/domain";

export interface ReviewedTransactionValues {
  type: "income" | "expense";
  date: string;
  amount: number;
  category: string;
  description: string;
  counterpartyName: string;
  paymentMethod: string;
}

const proposedValueByReviewField = (run: ExtractionRun): Record<keyof ReviewedTransactionValues, JsonValue | undefined> => ({
  type: run.normalizedProposedResult?.direction,
  date: run.normalizedProposedResult?.transactionDate,
  amount: run.normalizedProposedResult?.total?.amount,
  category: run.normalizedProposedResult?.category,
  description: run.normalizedProposedResult?.description,
  counterpartyName: run.normalizedProposedResult?.counterpartyName,
  paymentMethod: run.normalizedProposedResult?.paymentMethod,
});

const reviewedValueByField = (values: ReviewedTransactionValues): Record<keyof ReviewedTransactionValues, JsonValue> => ({
  ...values,
  amount: String(values.amount),
});

function reviewValuesMatch(field: keyof ReviewedTransactionValues, original: JsonValue | undefined, reviewed: JsonValue): boolean {
  if (original === undefined) return reviewed === "";
  if (field === "amount") return Number(original) === Number(reviewed);
  return String(original) === String(reviewed);
}

/** Records the owner decision while preserving the original extraction proposal. */
export function approveExtractionRun(
  run: ExtractionRun,
  reviewedValues: ReviewedTransactionValues,
  metadata: { reviewedBy: UserId | string; reviewedAt: ISODateTime | string; reviewerNotes?: string },
): ExtractionRun {
  const original = proposedValueByReviewField(run);
  const reviewed = reviewedValueByField(reviewedValues);
  const changedFields = (Object.keys(reviewed) as Array<keyof ReviewedTransactionValues>)
    .filter((field) => !reviewValuesMatch(field, original[field], reviewed[field]))
    .map<ReviewedFieldChange>((field) => ({
      fieldPath: field === "amount" ? "total.amount" : field,
      originalValue: original[field] ?? null,
      reviewedValue: reviewed[field],
    }));

  return extractionRunSchema.parse({
    ...run,
    status: "approved",
    reviewedBy: metadata.reviewedBy,
    reviewedAt: metadata.reviewedAt,
    ...(metadata.reviewerNotes ? { reviewerNotes: metadata.reviewerNotes } : {}),
    changedFields,
    updatedAt: metadata.reviewedAt,
    updatedBy: metadata.reviewedBy,
  });
}

export type ApprovalAuditEvent =
  | { id: string; kind: "evidence_received"; occurredAt: ISODateTime; title: "Evidence received"; detail: string }
  | { id: string; kind: "draft_prepared"; occurredAt: ISODateTime; title: "Draft prepared"; detail: string }
  | { id: string; kind: "field_changed"; occurredAt: ISODateTime; title: string; detail: string; fieldPath: string; originalValue: JsonValue; reviewedValue: JsonValue }
  | { id: string; kind: "approved"; occurredAt: ISODateTime; title: "Record approved"; detail: string; reviewedBy: UserId }
  | { id: string; kind: "checks_rerun"; occurredAt: ISODateTime; title: "Niaga checks rerun"; detail: string };

const sourceLabels: Record<SourceDocument["sourceType"], string> = {
  manual: "Manual record",
  receipt: "Receipt",
  voice: "Voice note",
  whatsapp: "WhatsApp message",
  csv: "CSV row",
  bank_statement: "Bank statement",
  external_system: "Connected system record",
};

const fieldLabels: Record<string, string> = {
  type: "Transaction type",
  date: "Date",
  "total.amount": "Amount",
  category: "Category",
  description: "Description",
  counterpartyName: "Customer or merchant",
  paymentMethod: "Payment method",
};

function displayValue(value: JsonValue): string {
  if (value === null) return "Not provided";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

/** Derives owner-facing history from persisted source, extraction, and transaction records. */
export function deriveApprovalAuditTimeline(input: {
  sourceDocument: SourceDocument;
  extractionRun: ExtractionRun;
  transaction?: FinancialTransaction;
  checksRerunAt?: ISODateTime;
}): ApprovalAuditEvent[] {
  const { sourceDocument, extractionRun, transaction, checksRerunAt } = input;
  if (extractionRun.sourceDocumentId !== sourceDocument.id) {
    throw new Error("The extraction run does not belong to this evidence document.");
  }
  if (transaction && !transaction.sourceLinks.some((link) =>
    link.sourceDocumentId === sourceDocument.id && link.extractionRunId === extractionRun.id)) {
    throw new Error("The transaction is not linked to this extraction run.");
  }

  const events: ApprovalAuditEvent[] = [{
    id: `${sourceDocument.id}:received`,
    kind: "evidence_received",
    occurredAt: sourceDocument.capturedAt,
    title: "Evidence received",
    detail: sourceDocument.originalFilename || sourceLabels[sourceDocument.sourceType],
  }];

  if (extractionRun.completedAt) {
    events.push({
      id: `${extractionRun.id}:prepared`,
      kind: "draft_prepared",
      occurredAt: extractionRun.completedAt,
      title: "Draft prepared",
      detail: `Prepared from ${sourceLabels[sourceDocument.sourceType].toLowerCase()}.`,
    });
  }

  if (extractionRun.reviewedAt) {
    for (const change of extractionRun.changedFields) {
      const label = fieldLabels[change.fieldPath] || change.fieldPath;
      events.push({
        id: `${extractionRun.id}:changed:${change.fieldPath}`,
        kind: "field_changed",
        occurredAt: extractionRun.reviewedAt,
        title: `${label} corrected`,
        detail: `${displayValue(change.originalValue)} → ${displayValue(change.reviewedValue)}`,
        fieldPath: change.fieldPath,
        originalValue: change.originalValue,
        reviewedValue: change.reviewedValue,
      });
    }
    if (extractionRun.reviewedBy && extractionRun.status === "approved") {
      events.push({
        id: `${extractionRun.id}:approved`,
        kind: "approved",
        occurredAt: extractionRun.reviewedAt,
        title: "Record approved",
        detail: `Approved by ${extractionRun.reviewedBy}.`,
        reviewedBy: extractionRun.reviewedBy,
      });
    }
  }

  if (checksRerunAt) {
    events.push({
      id: `${extractionRun.id}:checks:${checksRerunAt}`,
      kind: "checks_rerun",
      occurredAt: checksRerunAt,
      title: "Niaga checks rerun",
      detail: "Internal record checks were updated after approval.",
    });
  }

  return events.sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
}
