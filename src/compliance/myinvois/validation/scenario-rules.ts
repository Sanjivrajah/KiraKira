import type { MyInvoisValidationRule } from "./validation-rule";

export const scenarioRules: MyInvoisValidationRule[] = [
  {
    ruleId: "scenario.self-billed.document-type",
    category: "invoice",
    severity: "error",
    appliesWhen: ({ scenario }) => scenario === "self_billed_invoice",
    validate: ({ document }) => document.documentType.startsWith("self_billed_") ? [] : [{}],
    fieldPath: "document.documentType",
    message: "Self-billed scenario requires a self-billed document type.",
    sourceReferenceLabel: "MyInvois Self-Billed Invoice",
  },
  {
    ruleId: "scenario.consolidated.general-public",
    category: "myinvois",
    severity: "error",
    appliesWhen: ({ scenario }) => scenario === "consolidated_transaction",
    validate: ({ buyer, document }) => {
      const failures = buyer?.kind === "general_public" ? [] : [{ fieldPath: "buyer.kind", message: "Consolidated scenario requires a general-public buyer." }];
      if (document.lines.some((line) => line.classificationCode !== "004")) {
        failures.push({ fieldPath: "document.lines", message: "Consolidated lines must use classification 004." });
      }
      return failures;
    },
    fieldPath: "buyer",
    message: "Consolidated transactions require the general-public scenario and classification.",
    sourceReferenceLabel: "MyInvois Consolidated e-Invoice guidance",
  },
  {
    ruleId: "scenario.foreign-buyer.party-kind",
    category: "invoice",
    severity: "error",
    appliesWhen: ({ scenario }) => scenario === "foreign_buyer",
    validate: ({ buyer }) => buyer?.kind === "foreign_entity" ? [] : [{}],
    fieldPath: "buyer.kind",
    message: "Foreign-buyer scenario requires a foreign party.",
    sourceReferenceLabel: "NiagaAI scenario consistency rule",
  },
];
