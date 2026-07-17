import { z } from "zod";
import {
  INVOICE_V1_0_FIELD_REGISTRY,
  type InvoiceFieldDefinition,
} from "@/compliance/myinvois";
import type { EInvoiceScenario } from "./contracts";

const optionalText = z.string().trim().max(500).optional().or(z.literal(""));
const optionalDate = z.string().date().optional().or(z.literal(""));
const optionalTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/).optional().or(z.literal(""));
const optionalPositiveDecimal = z.string().regex(/^\d+(?:\.\d+)?$/).refine((value) => Number(value) > 0, "Enter a value greater than zero.").optional().or(z.literal(""));

export const preparationSupplementalSchema = z.object({
  documentOnlyIssueTime: optionalTime,
  exchangeRate: optionalPositiveDecimal,
  billingFrequency: optionalText,
  billingPeriodStart: optionalDate,
  billingPeriodEnd: optionalDate,
  prepaymentDate: optionalDate,
  prepaymentTime: optionalTime,
  prepaymentReference: optionalText,
  customsFormReference: optionalText,
  incoterms: optionalText,
  freeTradeAgreement: optionalText,
  certifiedExporterAuthorisation: optionalText,
  customsForm2: optionalText,
}).strict().superRefine((value, context) => {
  if (Boolean(value.billingPeriodStart) !== Boolean(value.billingPeriodEnd)) {
    context.addIssue({ code: "custom", path: [value.billingPeriodStart ? "billingPeriodEnd" : "billingPeriodStart"], message: "Enter both billing period dates." });
  }
  if (value.billingPeriodStart && value.billingPeriodEnd && value.billingPeriodEnd < value.billingPeriodStart) {
    context.addIssue({ code: "custom", path: ["billingPeriodEnd"], message: "Billing period end cannot precede its start." });
  }
});

export type PreparationSupplementalFields = z.infer<typeof preparationSupplementalSchema>;

export interface PreparationFieldDefinition {
  key: keyof PreparationSupplementalFields;
  registryKey: string;
  registry: InvoiceFieldDefinition;
  label: string;
  helpText: string;
  inputType: "text" | "date" | "time" | "decimal";
  cardinality: string;
  scope: "document";
  reusable: false;
  documentOnly: true;
  appliesWhen(scenario: EInvoiceScenario): boolean;
}

function registry(key: string) {
  const definition = INVOICE_V1_0_FIELD_REGISTRY.find((field) => field.key === key);
  if (!definition) throw new Error(`Missing Stage 1 field registry definition: ${key}`);
  return definition;
}

function define(input: Omit<PreparationFieldDefinition, "registry">): PreparationFieldDefinition {
  return { ...input, registry: registry(input.registryKey) };
}

const always = () => true;
const importExport = (scenario: EInvoiceScenario) => scenario === "import_export";

/** UI-safe document fields, each traceable to the Stage 1 field matrix. */
export const PREPARATION_FIELD_REGISTRY: readonly PreparationFieldDefinition[] = Object.freeze([
  define({ key: "documentOnlyIssueTime", registryKey: "document.issue_time", label: "Issue time", helpText: "A document-only override recorded for this preparation revision.", inputType: "time", cardinality: "1", scope: "document", reusable: false, documentOnly: true, appliesWhen: always }),
  define({ key: "exchangeRate", registryKey: "document.exchange_rate", label: "Exchange rate to MYR", helpText: "Required when the invoice currency is not MYR.", inputType: "decimal", cardinality: "0..1", scope: "document", reusable: false, documentOnly: true, appliesWhen: (scenario) => scenario === "foreign_currency" }),
  define({ key: "billingFrequency", registryKey: "document.billing_frequency", label: "Billing frequency", helpText: "For recurring or periodic billing, such as monthly.", inputType: "text", cardinality: "0..1", scope: "document", reusable: false, documentOnly: true, appliesWhen: always }),
  define({ key: "billingPeriodStart", registryKey: "billing.start_date", label: "Billing period start", helpText: "Enter both start and end dates when a billing period applies.", inputType: "date", cardinality: "0..1", scope: "document", reusable: false, documentOnly: true, appliesWhen: always }),
  define({ key: "billingPeriodEnd", registryKey: "billing.end_date", label: "Billing period end", helpText: "Enter both start and end dates when a billing period applies.", inputType: "date", cardinality: "0..1", scope: "document", reusable: false, documentOnly: true, appliesWhen: always }),
  define({ key: "prepaymentDate", registryKey: "prepayment.date", label: "Prepayment date", helpText: "Date of a prepayment already reflected in the invoice totals.", inputType: "date", cardinality: "0..1", scope: "document", reusable: false, documentOnly: true, appliesWhen: always }),
  define({ key: "prepaymentTime", registryKey: "prepayment.time", label: "Prepayment time", helpText: "Optional time associated with the prepayment.", inputType: "time", cardinality: "0..1", scope: "document", reusable: false, documentOnly: true, appliesWhen: always }),
  define({ key: "prepaymentReference", registryKey: "prepayment.reference", label: "Prepayment reference", helpText: "A traceable reference for the prepayment.", inputType: "text", cardinality: "0..1", scope: "document", reusable: false, documentOnly: true, appliesWhen: always }),
  define({ key: "customsFormReference", registryKey: "annexure.customs_form_1_9", label: "Customs Form No. 1 or 9 reference", helpText: "Required only when the applicable import or export condition applies.", inputType: "text", cardinality: "0..n", scope: "document", reusable: false, documentOnly: true, appliesWhen: importExport }),
  define({ key: "incoterms", registryKey: "annexure.incoterms", label: "Incoterms", helpText: "Trade terms for applicable imports or exports.", inputType: "text", cardinality: "0..1", scope: "document", reusable: false, documentOnly: true, appliesWhen: importExport }),
  define({ key: "freeTradeAgreement", registryKey: "annexure.fta", label: "Free trade agreement information", helpText: "Export-only information where applicable.", inputType: "text", cardinality: "0..1", scope: "document", reusable: false, documentOnly: true, appliesWhen: importExport }),
  define({ key: "certifiedExporterAuthorisation", registryKey: "annexure.certified_exporter", label: "Certified exporter authorisation", helpText: "Export-only authorisation number where applicable.", inputType: "text", cardinality: "0..1", scope: "document", reusable: false, documentOnly: true, appliesWhen: importExport }),
  define({ key: "customsForm2", registryKey: "annexure.customs_form_2", label: "Customs Form No. 2 reference", helpText: "Export declaration reference where applicable.", inputType: "text", cardinality: "0..1", scope: "document", reusable: false, documentOnly: true, appliesWhen: importExport }),
]);
