import { compareDecimalValues, decimalStringSchema } from "@/domain";
import type { MyInvoisValidationRule } from "./validation-rule";

const zero = decimalStringSchema.parse("0");

export const lineRules: MyInvoisValidationRule[] = [
  {
    ruleId: "line.description.present",
    category: "invoice",
    severity: "error",
    appliesWhen: () => true,
    validate: ({ document }) => document.lines.flatMap((line, index) => line.description.trim() ? [] : [{ fieldPath: `document.lines[${index}].description` }]),
    fieldPath: "document.lines",
    message: "Every line requires a product or service description.",
    sourceReferenceLabel: "MyInvois Invoice v1.1 Line Description",
  },
  {
    ruleId: "line.classification.active",
    category: "myinvois",
    severity: "error",
    appliesWhen: () => true,
    validate: ({ document, referenceData, asOfDate }) => document.lines.flatMap((line, index) =>
      referenceData.isActive("classification", line.classificationCode, asOfDate)
        ? []
        : [{ fieldPath: `document.lines[${index}].classificationCode`, message: `Classification code ${line.classificationCode} is inactive or unknown.` }],
    ),
    fieldPath: "document.lines",
    message: "Every line requires an active MyInvois classification code.",
    sourceReferenceLabel: "MyInvois Classification Codes",
  },
  {
    ruleId: "line.quantity-unit.valid",
    category: "myinvois",
    severity: "error",
    appliesWhen: () => true,
    validate: ({ document, referenceData, asOfDate }) => document.lines.flatMap((line, index) => {
      const failures = compareDecimalValues(line.quantity, zero) > 0 ? [] : [{ fieldPath: `document.lines[${index}].quantity`, message: "Line quantity must be greater than zero." }];
      if (!referenceData.isActive("unit_of_measurement", line.unitCode, asOfDate)) {
        failures.push({ fieldPath: `document.lines[${index}].unitCode`, message: `Unit code ${line.unitCode} is inactive or unknown.` });
      }
      return failures;
    }),
    fieldPath: "document.lines",
    message: "Every line requires a positive quantity and active unit code.",
    sourceReferenceLabel: "MyInvois Unit of Measurement",
  },
];
