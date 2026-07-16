import { businessRules } from "./business-rules";
import { documentRules } from "./document-rules";
import { lineRules } from "./line-rules";
import { partyRules } from "./party-rules";
import { scenarioRules } from "./scenario-rules";
import { taxRules } from "./tax-rules";
import type {
  MyInvoisValidationContext,
  MyInvoisValidationRule,
  ReadinessCategory,
  ReadinessValidationIssue,
} from "./validation-rule";

export interface ReadinessSummary {
  ready: boolean;
  errors: number;
  warnings: number;
  issues: ReadinessValidationIssue[];
}

export interface MyInvoisReadinessResult {
  bookkeeping: ReadinessSummary;
  invoice: ReadinessSummary;
  myInvoisSubmission: ReadinessSummary;
  allIssues: ReadinessValidationIssue[];
  validatedAt: string;
  scenario: MyInvoisValidationContext["scenario"];
  documentVersion: string;
}

export const DEFAULT_MYINVOIS_VALIDATION_RULES: readonly MyInvoisValidationRule[] = Object.freeze([
  ...businessRules,
  ...partyRules,
  ...documentRules,
  ...lineRules,
  ...taxRules,
  ...scenarioRules,
]);

const readinessOrder: ReadinessCategory[] = ["bookkeeping", "invoice", "myinvois"];

function summarize(issues: ReadinessValidationIssue[], includedCategories: ReadinessCategory[]): ReadinessSummary {
  const included = issues.filter((issue) => includedCategories.includes(issue.category));
  const errors = included.filter((issue) => issue.severity === "error").length;
  return {
    ready: errors === 0,
    errors,
    warnings: included.filter((issue) => issue.severity === "warning").length,
    issues: included,
  };
}

export function validateMyInvoisReadiness(
  context: MyInvoisValidationContext,
  rules: readonly MyInvoisValidationRule[] = DEFAULT_MYINVOIS_VALIDATION_RULES,
): MyInvoisReadinessResult {
  const allIssues = rules.flatMap((rule) => {
    if (!rule.appliesWhen(context)) return [];
    return rule.validate(context).map((failure) => ({
      ruleId: rule.ruleId,
      category: rule.category,
      severity: rule.severity,
      fieldPath: failure.fieldPath ?? rule.fieldPath,
      message: failure.message ?? rule.message,
      sourceReferenceLabel: rule.sourceReferenceLabel,
    }));
  });
  return {
    bookkeeping: summarize(allIssues, readinessOrder.slice(0, 1)),
    invoice: summarize(allIssues, readinessOrder.slice(0, 2)),
    myInvoisSubmission: summarize(allIssues, readinessOrder),
    allIssues,
    validatedAt: context.validatedAt,
    scenario: context.scenario,
    documentVersion: context.documentVersion,
  };
}
