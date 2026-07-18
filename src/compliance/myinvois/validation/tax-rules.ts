import { compareDecimalValues, decimalStringSchema } from "@/domain";
import type { MyInvoisValidationRule } from "./validation-rule";

const zero = decimalStringSchema.parse("0");

export const taxRules: MyInvoisValidationRule[] = [
  {
    ruleId: "tax.type.active",
    category: "myinvois",
    severity: "error",
    appliesWhen: () => true,
    validate: ({ document, referenceData, asOfDate }) => document.lines.flatMap((line, index) =>
      referenceData.isActive("tax_type", line.taxTreatment.taxTypeCode, asOfDate)
        ? []
        : [{ fieldPath: `document.lines[${index}].taxTreatment.taxTypeCode`, message: `Tax type ${line.taxTreatment.taxTypeCode} is inactive or unknown.` }],
    ),
    fieldPath: "document.lines",
    message: "Every line requires an active MyInvois tax type.",
    sourceReferenceLabel: "MyInvois Tax Types",
  },
  {
    ruleId: "tax.totals.present",
    category: "invoice",
    severity: "error",
    appliesWhen: () => true,
    validate: ({ document }) => document.taxTotals.length > 0 ? [] : [{}],
    fieldPath: "document.taxTotals",
    message: "Grouped tax totals are required.",
    sourceReferenceLabel: "MyInvois Invoice v1.0 Tax Total",
  },
  {
    ruleId: "document.payable.nonnegative",
    category: "bookkeeping",
    severity: "error",
    appliesWhen: () => true,
    validate: ({ document }) => compareDecimalValues(document.monetaryTotals.payableAmount.amount, zero) >= 0 ? [] : [{}],
    fieldPath: "document.monetaryTotals.payableAmount",
    message: "Payable total cannot be negative.",
    sourceReferenceLabel: "NiagaAI document reconciliation rule",
  },
];
