import type { Business, CommercialDocument, ISODate, ISODateTime, Party } from "@/domain";
import type { MyInvoisReferenceCatalog } from "../reference-data";

export type MyInvoisValidationScenario =
  | "b2b_invoice"
  | "b2c_invoice"
  | "consolidated_transaction"
  | "self_billed_invoice"
  | "foreign_buyer"
  | "credit_note"
  | "debit_note"
  | "refund_note";

export type ReadinessCategory = "bookkeeping" | "invoice" | "myinvois";
export type ReadinessSeverity = "warning" | "error";

export interface MyInvoisValidationContext {
  document: CommercialDocument;
  business?: Business;
  supplier?: Party;
  buyer?: Party;
  scenario: MyInvoisValidationScenario;
  referenceData: MyInvoisReferenceCatalog;
  asOfDate: ISODate;
  validatedAt: ISODateTime;
  documentVersion: string;
}

export interface ValidationRuleFailure {
  fieldPath?: string;
  message?: string;
}

export interface MyInvoisValidationRule {
  ruleId: string;
  category: ReadinessCategory;
  severity: ReadinessSeverity;
  appliesWhen: (context: MyInvoisValidationContext) => boolean;
  validate: (context: MyInvoisValidationContext) => ValidationRuleFailure[];
  fieldPath: string;
  message: string;
  sourceReferenceLabel: string;
}

export interface ReadinessValidationIssue {
  ruleId: string;
  category: ReadinessCategory;
  severity: ReadinessSeverity;
  fieldPath: string;
  message: string;
  sourceReferenceLabel: string;
}
