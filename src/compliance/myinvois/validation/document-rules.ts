import type { CommercialDocumentType } from "@/domain";
import { MYINVOIS_DOCUMENT_VERSIONS } from "../types/document-version";
import type { MyInvoisValidationRule } from "./validation-rule";

export const MYINVOIS_DOCUMENT_TYPE_CODES: Record<CommercialDocumentType, string> = {
  invoice: "01",
  credit_note: "02",
  debit_note: "03",
  refund_note: "04",
  self_billed_invoice: "11",
  self_billed_credit_note: "12",
  self_billed_debit_note: "13",
  self_billed_refund_note: "14",
};

export const documentRules: MyInvoisValidationRule[] = [
  {
    ruleId: "document.version.active",
    category: "myinvois",
    severity: "error",
    appliesWhen: () => true,
    validate: ({ documentVersion, asOfDate }) => {
      const version = MYINVOIS_DOCUMENT_VERSIONS.find((candidate) => candidate.version === documentVersion);
      const active = version?.active
        && (!version.effectiveFrom || version.effectiveFrom <= asOfDate)
        && (!version.effectiveTo || version.effectiveTo >= asOfDate);
      return active ? [] : [{}];
    },
    fieldPath: "documentVersion",
    message: "Document version is not supported for local MyInvois validation.",
    sourceReferenceLabel: "MyInvois SDK document versions",
  },
  {
    ruleId: "document.issue-date.present",
    category: "bookkeeping",
    severity: "error",
    appliesWhen: () => true,
    validate: ({ document }) => document.issueDate ? [] : [{}],
    fieldPath: "document.issueDate",
    message: "Issue date is required.",
    sourceReferenceLabel: "NiagaAI bookkeeping contract",
  },
  {
    ruleId: "document.currency.active",
    category: "myinvois",
    severity: "error",
    appliesWhen: () => true,
    validate: ({ document, referenceData, asOfDate }) => referenceData.isActive("currency", document.currency, asOfDate) ? [] : [{}],
    fieldPath: "document.currency",
    message: "Document currency is not active in current MyInvois reference data.",
    sourceReferenceLabel: "MyInvois Currency Codes",
  },
  {
    ruleId: "document.type.active",
    category: "myinvois",
    severity: "error",
    appliesWhen: () => true,
    validate: ({ document, referenceData, asOfDate }) => referenceData.isActive("invoice_type", MYINVOIS_DOCUMENT_TYPE_CODES[document.documentType], asOfDate) ? [] : [{}],
    fieldPath: "document.documentType",
    message: "Document type is not active in current MyInvois reference data.",
    sourceReferenceLabel: "MyInvois e-Invoice Types",
  },
  {
    ruleId: "document.exchange-rate.required",
    category: "myinvois",
    severity: "error",
    appliesWhen: ({ document }) => document.currency !== "MYR",
    validate: ({ document }) => document.exchangeRate ? [] : [{}],
    fieldPath: "document.exchangeRate",
    message: "Foreign-currency documents require an exchange rate to MYR.",
    sourceReferenceLabel: "MyInvois Invoice v1.0 Currency Exchange Rate",
  },
  {
    ruleId: "document.adjustment-reference.required",
    category: "invoice",
    severity: "error",
    appliesWhen: ({ document }) => ["credit_note", "debit_note", "refund_note"].some((type) => document.documentType.endsWith(type)),
    validate: ({ document }) => document.references.some((reference) => reference.type === "original_invoice") ? [] : [{}],
    fieldPath: "document.references",
    message: "Adjustment documents require an original invoice reference.",
    sourceReferenceLabel: "NiagaAI commercial-document integrity rule",
  },
  {
    ruleId: "document.payment-mode.active",
    category: "myinvois",
    severity: "error",
    appliesWhen: ({ document }) => Boolean(document.paymentInstructions?.paymentModeCode),
    validate: ({ document, referenceData, asOfDate }) => referenceData.isActive("payment_mode", document.paymentInstructions?.paymentModeCode ?? "", asOfDate) ? [] : [{}],
    fieldPath: "document.paymentInstructions.paymentModeCode",
    message: "Payment mode is not active in current MyInvois reference data.",
    sourceReferenceLabel: "MyInvois Payment Modes",
  },
  {
    ruleId: "document.payment-information.recommended",
    category: "invoice",
    severity: "warning",
    appliesWhen: ({ document }) => document.documentType.endsWith("invoice"),
    validate: ({ document }) => document.paymentInstructions ? [] : [{}],
    fieldPath: "document.paymentInstructions",
    message: "Payment instructions are recommended for invoices.",
    sourceReferenceLabel: "NiagaAI invoice usability rule",
  },
];
