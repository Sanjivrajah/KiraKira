import {
  MYINVOIS_DEVELOPMENT_REFERENCE_CODES,
  INVOICE_V1_0_FIELD_REGISTRY,
  createMyInvoisReferenceCatalog,
  validateMyInvoisReadiness,
  type MyInvoisValidationScenario,
} from "@/compliance/myinvois";
import { businessDomainSchema, isoDateSchema, isoDateTimeSchema, partySchema } from "@/domain";
import { AssembleEInvoiceDocumentService, type EInvoiceAssemblyResult } from "./assembly-service";
import type {
  AssemblyDiagnostic,
  EInvoiceCandidate,
  EInvoicePreparationRecord,
  EInvoicePreparationView,
  EInvoicePreparationRepository,
  EInvoiceSourceRepository,
  PreparationDiagnostic,
  PreparationDiagnosticGroup,
  PreparationReadinessResult,
  SupplierSnapshot,
} from "./contracts";
import { PREPARATION_FIELD_REGISTRY, preparationSupplementalSchema, type PreparationSupplementalFields } from "./preparation-fields";

const referenceData = createMyInvoisReferenceCatalog(MYINVOIS_DEVELOPMENT_REFERENCE_CODES);

function groupFor(fieldPath: string): PreparationDiagnosticGroup {
  if (fieldPath.startsWith("supplier.") || fieldPath.startsWith("business.")) return "supplier";
  if (fieldPath.startsWith("buyer.")) return "buyer";
  if (fieldPath.includes("lines[")) return "line";
  if (fieldPath.startsWith("tax") || fieldPath.includes("taxTreatment")) return "tax";
  if (fieldPath.startsWith("scenario.")) return "scenario";
  return "document";
}

function validationScenario(scenario: EInvoicePreparationRecord["scenario"]): MyInvoisValidationScenario {
  return ["consolidated_transaction", "foreign_buyer", "self_billed_invoice", "credit_note", "debit_note", "refund_note"].includes(scenario)
    ? scenario as MyInvoisValidationScenario
    : "b2b_invoice";
}

function assemblyDiagnostic(diagnostic: AssemblyDiagnostic): PreparationDiagnostic {
  return {
    code: diagnostic.code,
    fieldPath: diagnostic.fieldPath,
    message: diagnostic.message,
    severity: "error",
    group: groupFor(diagnostic.fieldPath),
    sourceReferenceLabel: "NiagaAI persisted source assembly",
  };
}

function registryDiagnostic(code: string, fieldPath: string, message: string, registryKey: string): PreparationDiagnostic {
  const definition = INVOICE_V1_0_FIELD_REGISTRY.find((field) => field.key === registryKey);
  return {
    code, fieldPath, message, severity: "error", group: groupFor(fieldPath),
    sourceReferenceLabel: definition?.label ?? "MyInvois Invoice v1.0 field requirements",
  };
}

export function evaluatePreparationReadiness(input: Pick<EInvoiceAssemblyResult, "canonicalDocument" | "supplierSnapshot" | "buyerSnapshot" | "supplementalFields" | "diagnostics" | "scenario">, now: string): PreparationReadinessResult {
  const validatedAt = isoDateTimeSchema.parse(now);
  const diagnostics: PreparationDiagnostic[] = input.diagnostics.map(assemblyDiagnostic);
  if (input.scenario !== "b2b_invoice") {
    diagnostics.push({
      code: "scenario.not_verified",
      fieldPath: "scenario",
      message: "Only standard Malaysian B2B invoices are enabled. This scenario requires dedicated golden fixtures and sandbox verification.",
      severity: "error",
      group: "scenario",
      sourceReferenceLabel: "NiagaAI Invoice v1.0 production scope",
    });
  }
  const supplierSnapshot = input.supplierSnapshot as Partial<SupplierSnapshot>;
  const supplier = partySchema.safeParse(supplierSnapshot.party);
  const buyer = partySchema.safeParse(input.buyerSnapshot);

  if (input.canonicalDocument && supplier.success && buyer.success) {
    const business = businessDomainSchema.safeParse({
      id: input.canonicalDocument.businessId,
      legalName: supplier.data.legalName,
      tradingName: supplier.data.tradingName,
      entityType: "other",
      compliance: {
        tin: supplier.data.taxIdentifiers.find((identifier) => identifier.scheme === "tin"),
        registration: supplier.data.registrationIdentifiers[0],
        sstRegistrations: supplier.data.taxIdentifiers.filter((identifier) => identifier.scheme === "sst"),
        tourismTaxRegistration: supplier.data.taxIdentifiers.find((identifier) => identifier.scheme === "tourism_tax"),
        msicCode: supplierSnapshot.msicCode,
        businessActivityDescription: supplierSnapshot.businessActivityDescription,
      },
      contact: { email: supplier.data.email, phone: supplier.data.phone },
      address: supplier.data.billingAddress,
      defaultCurrency: supplier.data.defaultCurrency ?? input.canonicalDocument.currency,
      preferredLanguage: "en",
      timezone: "Asia/Kuala_Lumpur",
      createdAt: supplier.data.createdAt,
      updatedAt: supplier.data.updatedAt,
      version: supplier.data.version,
    });
    const result = validateMyInvoisReadiness({
      document: input.canonicalDocument,
      ...(business.success ? { business: business.data } : {}),
      supplier: supplier.data,
      buyer: buyer.data,
      scenario: validationScenario(input.scenario),
      referenceData,
      asOfDate: isoDateSchema.parse(validatedAt.slice(0, 10)),
      validatedAt,
      documentVersion: "1.0",
    });
    diagnostics.push(...result.allIssues.map((issue) => ({
      code: issue.ruleId,
      fieldPath: issue.fieldPath,
      message: issue.message,
      severity: issue.severity,
      group: groupFor(issue.fieldPath),
      sourceReferenceLabel: issue.sourceReferenceLabel,
    })));
    diagnostics.push({
      code: "derived.document_totals",
      fieldPath: "document.monetaryTotals",
      message: "Document totals and tax groups were derived from the frozen invoice lines.",
      severity: "derived",
      group: "tax",
      sourceReferenceLabel: "NiagaAI canonical calculation service",
    });

    const requiredValues: Array<[unknown, string, string, string]> = [
      [supplier.data.phone, "supplier.phone", "Supplier contact number is required.", "supplier.phone"],
      [supplier.data.billingAddress?.addressLines[0], "supplier.billingAddress.addressLines[0]", "Supplier address line 0 is required.", "supplier.address.line0"],
      [supplier.data.billingAddress?.city, "supplier.billingAddress.city", "Supplier city is required.", "supplier.address.city"],
      [supplier.data.billingAddress?.stateCode, "supplier.billingAddress.stateCode", "Supplier state or country subentity is required.", "supplier.address.state"],
      [supplier.data.billingAddress?.countryCode, "supplier.billingAddress.countryCode", "Supplier country is required.", "supplier.address.country"],
      [buyer.data.phone, "buyer.phone", "Buyer contact number is required for an individual B2B invoice.", "buyer.phone"],
      [buyer.data.billingAddress?.addressLines[0], "buyer.billingAddress.addressLines[0]", "Buyer address line 0 is required.", "buyer.address.line0"],
      [buyer.data.billingAddress?.city, "buyer.billingAddress.city", "Buyer city is required.", "buyer.address.city"],
      [buyer.data.billingAddress?.stateCode, "buyer.billingAddress.stateCode", "Buyer state or country subentity is required.", "buyer.address.state"],
      [buyer.data.billingAddress?.countryCode, "buyer.billingAddress.countryCode", "Buyer country is required.", "buyer.address.country"],
    ];
    for (const [value, fieldPath, message, registryKey] of requiredValues) {
      if (!value && !diagnostics.some((item) => item.fieldPath === fieldPath)) {
        diagnostics.push(registryDiagnostic(`required.${registryKey}`, fieldPath, message, registryKey));
      }
    }
    input.canonicalDocument.lines.forEach((line, index) => {
      if (line.description.length > 300) diagnostics.push(registryDiagnostic("line.description.too_long", `document.lines[${index}].description`, "Line description cannot exceed 300 characters for Invoice v1.0.", "line.description"));
    });
    if (input.canonicalDocument.internalDocumentNumber.length > 50) {
      diagnostics.push(registryDiagnostic("document.number.too_long", "document.internalDocumentNumber", "The e-Invoice code cannot exceed 50 characters.", "document.number"));
    }
    const prepaymentMetadataPresent = ["prepaymentDate", "prepaymentTime", "prepaymentReference"]
      .some((key) => typeof input.supplementalFields[key] === "string" && String(input.supplementalFields[key]).trim());
    if (prepaymentMetadataPresent && Number(input.canonicalDocument.monetaryTotals.prepaidAmount.amount) <= 0) {
      diagnostics.push(registryDiagnostic("prepayment.amount.missing", "document.monetaryTotals.prepaidAmount", "Prepayment metadata requires a positive prepayment amount on the source invoice.", "prepayment.amount"));
    }
    if (input.scenario === "shipping_recipient" && !input.supplementalFields._shippingRecipientSnapshot) {
      diagnostics.push(registryDiagnostic("shipping.snapshot.missing", "shippingRecipient", "The shipping recipient must be frozen with this preparation revision.", "annexure.shipping_address"));
    }
  }

  if (!input.canonicalDocument && !diagnostics.length) {
    diagnostics.push({ code: "document.not_assembled", fieldPath: "document", message: "The source invoice could not be assembled.", severity: "error", group: "document", sourceReferenceLabel: "NiagaAI persisted source assembly" });
  }
  if (!supplier.success && !diagnostics.some((item) => item.group === "supplier")) {
    diagnostics.push({ code: "supplier.snapshot_invalid", fieldPath: "supplier", message: "The supplier snapshot is incomplete.", severity: "error", group: "supplier", sourceReferenceLabel: "NiagaAI supplier snapshot" });
  }
  if (!buyer.success && !diagnostics.some((item) => item.group === "buyer")) {
    diagnostics.push({ code: "buyer.snapshot_invalid", fieldPath: "buyer", message: "The buyer snapshot is incomplete.", severity: "error", group: "buyer", sourceReferenceLabel: "NiagaAI buyer snapshot" });
  }

  return {
    ready: !diagnostics.some((diagnostic) => diagnostic.severity === "error"),
    diagnostics,
    validatedAt,
    checkLabel: "NiagaAI internal preparation checks",
  };
}

export interface EInvoiceWorkspace {
  candidates: EInvoiceCandidate[];
  preparations: EInvoicePreparationView[];
  counts: { selected: number; needsInformation: number; ready: number; approved: number };
}

export class EInvoicePreparationService {
  private readonly assembler: AssembleEInvoiceDocumentService;

  constructor(private readonly sources: EInvoiceSourceRepository, private readonly preparations: EInvoicePreparationRepository) {
    this.assembler = new AssembleEInvoiceDocumentService(sources, preparations);
  }

  async workspace(businessId: string): Promise<EInvoiceWorkspace> {
    const [candidates, preparations] = await Promise.all([
      this.preparations.listCandidates(businessId),
      this.preparations.listPreparations(businessId),
    ]);
    const activeBySource = new Map(preparations.filter((record) => record.active).map((record) => [`${record.sourceInvoiceId}:${record.sourceInvoiceRevision}`, record]));
    const decorated = candidates.map((candidate) => {
      const record = activeBySource.get(`${candidate.id}:${candidate.revision}`);
      const alreadyFinal = record?.status === "approved";
      return {
        ...candidate,
        eligible: candidate.ineligibilityReasons.length === 0 && !alreadyFinal,
        ineligibilityReasons: alreadyFinal ? [...candidate.ineligibilityReasons, "This source revision already has an approved e-Invoice preparation."] : candidate.ineligibilityReasons,
        preparationId: record?.id,
        preparationStatus: record?.status,
      };
    });
    const preparationViews = preparations.map((record): EInvoicePreparationView => ({
      id: record.id, businessId: record.businessId, sourceInvoiceId: record.sourceInvoiceId,
      sourceInvoiceRevision: record.sourceInvoiceRevision, documentType: record.documentType,
      documentVersion: record.documentVersion, scenario: record.scenario,
      supplementalFields: Object.fromEntries(PREPARATION_FIELD_REGISTRY.flatMap((field) => {
        const value = record.supplementalFields[field.key];
        return typeof value === "string" ? [[field.key, value]] : [];
      })),
      readinessResult: record.readinessResult,
      status: record.status, revision: record.revision, approvedAt: record.approvedAt,
      supersedesDocumentId: record.supersedesDocumentId, active: record.active,
      submissionEligible: record.submissionEligible, createdAt: record.createdAt, updatedAt: record.updatedAt,
      hasCanonicalDocument: Boolean(record.canonicalDocument),
    }));
    return {
      candidates: decorated,
      preparations: preparationViews,
      counts: {
        selected: 0,
        needsInformation: preparations.filter((item) => item.active && item.status === "needs_information").length,
        ready: preparations.filter((item) => item.active && item.status === "ready").length,
        approved: preparations.filter((item) => item.status === "approved").length,
      },
    };
  }

  async prepareBatch(businessId: string, invoiceIds: readonly string[], now: string) {
    const uniqueIds = [...new Set(invoiceIds)];
    return Promise.all(uniqueIds.map(async (invoiceId) => {
      const assembled = await this.assembler.assemble(businessId, invoiceId, now);
      assembled.readinessResult = evaluatePreparationReadiness(assembled, now);
      return this.preparations.createOrRefresh(assembled);
    }));
  }

  async saveFields(businessId: string, documentId: string, expectedRevision: number, fields: PreparationSupplementalFields, now: string, actorId: string) {
    const parsedFields = preparationSupplementalSchema.parse(fields);
    const current = await this.preparations.findByBusinessAndId(businessId, documentId);
    if (!current || !current.active) throw new Error("The active preparation revision was not found.");
    if (current.status === "approved") throw new Error("Create a new revision before editing an approved preparation.");
    const auditedFields = { ...parsedFields, _overrideAudit: { actorId, enteredAt: now } };
    const assembled = await this.assembler.assemble(businessId, current.sourceInvoiceId, now, auditedFields);
    const readinessResult = evaluatePreparationReadiness(assembled, now);
    return this.preparations.replaceDraft({ ...assembled, documentId, expectedRevision, readinessResult });
  }

  async approve(businessId: string, documentId: string, expectedRevision: number, now: string) {
    const current = await this.preparations.findByBusinessAndId(businessId, documentId);
    if (!current || !current.active) throw new Error("The active preparation revision was not found.");
    const assembled = await this.assembler.assemble(businessId, current.sourceInvoiceId, now, current.supplementalFields);
    const readinessResult = evaluatePreparationReadiness(assembled, now);
    if (!readinessResult.ready) throw new Error("Resolve all blocking internal preparation checks before approval.");
    return this.preparations.approveReadyRevision(businessId, documentId, expectedRevision, readinessResult);
  }

  createRevision(businessId: string, documentId: string) {
    return this.preparations.createRevision(businessId, documentId);
  }
}
