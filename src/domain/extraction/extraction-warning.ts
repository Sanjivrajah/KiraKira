export type ExtractionWarningCode =
  | "missing_supplier_name"
  | "unreadable_total"
  | "conflicting_invoice_date"
  | "tax_total_mismatch"
  | "duplicate_candidate"
  | "unsupported_currency"
  | "low_confidence_classification"
  | "other";

export type ExtractionWarningSeverity = "info" | "warning" | "error";

export interface ExtractionWarning {
  code: ExtractionWarningCode;
  severity: ExtractionWarningSeverity;
  fieldPath?: string;
  message: string;
  suggestedAction: string;
}
