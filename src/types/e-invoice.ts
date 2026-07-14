import type { EntityId, ISODateTimeString } from "./common";

export interface EInvoiceValidationIssue {
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface EInvoiceReadinessSection {
  ready: boolean;
  missingFields: string[];
}

export interface EInvoiceReadinessResult {
  businessId: EntityId;
  invoiceId?: EntityId | null;
  ready: boolean;
  missingFields: string[];
  validationIssues: EInvoiceValidationIssue[];
  business: EInvoiceReadinessSection;
  customer: EInvoiceReadinessSection;
  invoice: EInvoiceReadinessSection;
  generatedAt: ISODateTimeString;
}
