import { describe, expect, it } from "vitest";
import type { ReadinessValidationIssue } from "@/compliance/myinvois";
import { invoicePreparationFieldTarget, invoicePreparationFixLabel } from "./invoice-preparation";

function issue(fieldPath: string): ReadinessValidationIssue {
  return {
    ruleId: "test.rule",
    category: "myinvois",
    severity: "error",
    fieldPath,
    message: "Fix this value.",
    sourceReferenceLabel: "MyInvois test reference",
  };
}

describe("invoice preparation presentation", () => {
  it("maps a rule-engine line path to the exact editable field", () => {
    const validationIssue = issue("document.lines[2].taxTreatment.taxTypeCode");

    expect(invoicePreparationFieldTarget(validationIssue)).toBe("items.2.taxTypeCode");
    expect(invoicePreparationFixLabel(validationIssue)).toBe("Choose tax type");
  });

  it("maps buyer identity issues to the customer control", () => {
    const validationIssue = issue("buyer.taxIdentifiers");

    expect(invoicePreparationFieldTarget(validationIssue)).toBe("buyerId");
    expect(invoicePreparationFixLabel(validationIssue)).toBe("Check customer");
  });

  it("routes business-profile issues outside the invoice form", () => {
    const validationIssue = issue("business.compliance.msicCode");

    expect(invoicePreparationFieldTarget(validationIssue)).toBeUndefined();
    expect(invoicePreparationFixLabel(validationIssue)).toBe("Update business details");
  });
});
