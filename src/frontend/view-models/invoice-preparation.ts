import {
  MYINVOIS_DEVELOPMENT_REFERENCE_CODES,
  createMyInvoisReferenceCatalog,
  validateMyInvoisReadiness,
  type MyInvoisReadinessResult,
  type MyInvoisValidationScenario,
  type ReadinessValidationIssue,
} from "@/compliance/myinvois";
import {
  isoDateSchema,
  isoDateTimeSchema,
  partySchema,
  type Business,
  type CommercialDocument,
  type Party,
} from "@/domain";

const referenceData = createMyInvoisReferenceCatalog(MYINVOIS_DEVELOPMENT_REFERENCE_CODES);

function determineScenario(document: CommercialDocument, buyer?: Party): MyInvoisValidationScenario {
  if (document.documentType.startsWith("self_billed_")) return "self_billed_invoice";
  if (document.documentType.includes("credit_note")) return "credit_note";
  if (document.documentType.includes("debit_note")) return "debit_note";
  if (document.documentType.includes("refund_note")) return "refund_note";
  if (buyer?.kind === "general_public") return "consolidated_transaction";
  if (buyer?.kind === "foreign_entity") return "foreign_buyer";
  return "b2b_invoice";
}

function businessToSupplier(business: Business): Party {
  return partySchema.parse({
    id: `party_${business.id}`,
    kind: "business",
    legalName: business.legalName,
    ...(business.tradingName ? { tradingName: business.tradingName } : {}),
    roles: ["seller", "supplier"],
    taxIdentifiers: [business.compliance.tin, ...business.compliance.sstRegistrations].filter(Boolean),
    registrationIdentifiers: business.compliance.registration ? [business.compliance.registration] : [],
    ...(business.contact.email ? { email: business.contact.email } : {}),
    ...(business.contact.phone ? { phone: business.contact.phone } : {}),
    billingAddress: business.address,
    defaultCurrency: business.defaultCurrency,
    createdAt: business.createdAt,
    updatedAt: business.updatedAt,
  });
}

export function createInvoicePreparationResult(input: {
  document: CommercialDocument;
  business?: Business;
  buyer?: Party;
  now: string;
}): MyInvoisReadinessResult {
  const validatedAt = isoDateTimeSchema.parse(input.now);
  return validateMyInvoisReadiness({
    document: input.document,
    ...(input.business ? { business: input.business, supplier: businessToSupplier(input.business) } : {}),
    ...(input.buyer ? { buyer: input.buyer } : {}),
    scenario: determineScenario(input.document, input.buyer),
    referenceData,
    asOfDate: isoDateSchema.parse(validatedAt.slice(0, 10)),
    validatedAt,
    documentVersion: "1.1",
  });
}

const directFieldTargets: Record<string, string> = {
  "document.issueDate": "issueDate",
  "document.documentType": "documentType",
  "document.references": "originalDocumentReference",
  "document.paymentInstructions": "paymentModeCode",
  "document.paymentInstructions.paymentModeCode": "paymentModeCode",
  "buyer.legalName": "buyerId",
  "buyer.taxIdentifiers": "buyerId",
  "buyer.registrationIdentifiers": "buyerId",
  "buyer.billingAddress": "buyerId",
  "buyer.billingAddress.countryCode": "buyerId",
  "buyer.billingAddress.stateCode": "buyerId",
};

export function invoicePreparationFieldTarget(issue: ReadinessValidationIssue): string | undefined {
  const direct = directFieldTargets[issue.fieldPath];
  if (direct) return direct;
  const lineMatch = issue.fieldPath.match(/^document\.lines\[(\d+)]\.(.+)$/);
  if (!lineMatch) return undefined;
  const [, index, field] = lineMatch;
  const lineField = field === "taxTreatment.taxTypeCode" ? "taxTypeCode" : field;
  return ["description", "quantity", "unitCode", "classificationCode", "taxTypeCode"].includes(lineField)
    ? `items.${index}.${lineField}`
    : undefined;
}

export function invoicePreparationFixLabel(issue: ReadinessValidationIssue): string {
  if (issue.fieldPath.startsWith("buyer.")) return "Check customer";
  if (issue.fieldPath.startsWith("supplier.") || issue.fieldPath.startsWith("business.")) return "Update business details";
  if (issue.fieldPath.includes("classificationCode")) return "Choose classification";
  if (issue.fieldPath.includes("taxTypeCode")) return "Choose tax type";
  if (issue.fieldPath.includes("unitCode")) return "Choose unit";
  if (issue.fieldPath.includes("description")) return "Add description";
  if (issue.fieldPath.includes("quantity")) return "Check quantity";
  return "Fix this field";
}
