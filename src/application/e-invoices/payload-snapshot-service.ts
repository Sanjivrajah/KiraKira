import { createHash } from "node:crypto";
import {
  MYINVOIS_MAPPER_REGISTRY,
  canonicalSerializeMyInvoisPayload,
  createPinnedMyInvoisReferenceCatalog,
  validateMyInvoisReadiness,
  type MyInvoisMapperRegistry,
  type MyInvoisReferenceCatalog,
  type MyInvoisValidationScenario,
} from "@/compliance/myinvois";
import { businessDomainSchema, isoDateSchema, isoDateTimeSchema, partySchema } from "@/domain";
import type {
  EInvoicePayloadSnapshotRecord,
  EInvoicePayloadSnapshotRepository,
  EInvoicePreparationRecord,
  SupplierSnapshot,
} from "./contracts";

export const MYINVOIS_MAX_DOCUMENT_BYTES = 300 * 1024;

const requiredReferenceSets = [
  "classification", "country", "currency", "invoice_type", "msic",
  "payment_mode", "state", "tax_type", "unit_of_measurement",
] as const;

function validationScenario(scenario: EInvoicePreparationRecord["scenario"]): MyInvoisValidationScenario {
  return ["consolidated_transaction", "foreign_buyer", "self_billed_invoice", "credit_note", "debit_note", "refund_note"].includes(scenario)
    ? scenario as MyInvoisValidationScenario
    : "b2b_invoice";
}

export class EInvoicePayloadGenerationError extends Error {
  constructor(readonly code: string, message: string, readonly diagnostics: readonly unknown[] = []) {
    super(message);
    this.name = "EInvoicePayloadGenerationError";
  }
}

export class GenerateEInvoicePayloadSnapshotService {
  constructor(
    private readonly snapshots: EInvoicePayloadSnapshotRepository,
    private readonly referenceData: MyInvoisReferenceCatalog = createPinnedMyInvoisReferenceCatalog(),
    private readonly mappers: MyInvoisMapperRegistry = MYINVOIS_MAPPER_REGISTRY,
  ) {}

  async generate(
    businessId: string,
    documentId: string,
    generatedAtInput: string,
  ): Promise<EInvoicePayloadSnapshotRecord> {
    const targetDocumentVersion = "1.0" as const;
    const generatedAt = isoDateTimeSchema.parse(generatedAtInput);
    const asOfDate = isoDateSchema.parse(generatedAt.slice(0, 10));
    this.referenceData.assertUsable(requiredReferenceSets, asOfDate);

    const approved = await this.snapshots.loadApprovedForGeneration(businessId, documentId);
    if (!approved || approved.status !== "approved" || !approved.active || !approved.submissionEligible) {
      throw new EInvoicePayloadGenerationError("document.not_eligible", "Only the active, approved, non-superseded revision can generate a payload.");
    }
    if (!approved.canonicalDocument) {
      throw new EInvoicePayloadGenerationError("document.snapshot_missing", "The approved canonical document snapshot is missing.");
    }
    if (approved.documentVersion !== "1.0") {
      throw new EInvoicePayloadGenerationError(
        "document.unsupported_historical_version",
        "This historical preparation uses a document version that is no longer supported. Create a new unsigned Invoice v1.0 preparation.",
      );
    }

    const supplierSnapshot = approved.supplierSnapshot as Partial<SupplierSnapshot>;
    const supplier = partySchema.parse(supplierSnapshot.party);
    const buyer = partySchema.parse(approved.buyerSnapshot);
    const business = businessDomainSchema.parse({
      id: approved.businessId,
      legalName: supplier.legalName,
      tradingName: supplier.tradingName,
      entityType: "other",
      compliance: {
        tin: supplier.taxIdentifiers.find((identifier) => identifier.scheme === "tin"),
        registration: supplier.registrationIdentifiers[0],
        sstRegistrations: supplier.taxIdentifiers.filter((identifier) => identifier.scheme === "sst"),
        tourismTaxRegistration: supplier.taxIdentifiers.find((identifier) => identifier.scheme === "tourism_tax"),
        msicCode: supplierSnapshot.msicCode,
        businessActivityDescription: supplierSnapshot.businessActivityDescription,
      },
      contact: { email: supplier.email, phone: supplier.phone },
      address: supplier.billingAddress,
      defaultCurrency: supplier.defaultCurrency ?? approved.canonicalDocument.currency,
      preferredLanguage: "en",
      timezone: "Asia/Kuala_Lumpur",
      createdAt: supplier.createdAt,
      updatedAt: supplier.updatedAt,
      version: supplier.version,
    });

    const readiness = validateMyInvoisReadiness({
      document: approved.canonicalDocument,
      supplier,
      buyer,
      business,
      scenario: validationScenario(approved.scenario),
      referenceData: this.referenceData,
      asOfDate,
      validatedAt: generatedAt,
      documentVersion: targetDocumentVersion,
    });
    if (!readiness.myInvoisSubmission.ready) {
      throw new EInvoicePayloadGenerationError(
        "document.readiness_failed",
        "The approved revision no longer passes the pinned MyInvois readiness checks.",
        readiness.allIssues,
      );
    }

    const mapper = this.mappers.resolve({
      version: targetDocumentVersion,
      documentType: approved.documentType,
      payloadFormat: "json",
    });
    const exactKey = {
      businessId,
      eInvoiceDocumentId: approved.id,
      documentRevision: approved.revision,
      documentVersion: targetDocumentVersion,
      mapperVersion: mapper.mapperVersion,
      referenceDataVersion: this.referenceData.version,
      format: "json" as const,
    };
    const existing = await this.snapshots.findExact(exactKey);
    if (existing) return existing;

    const shippingCandidate = approved.supplementalFields._shippingRecipientSnapshot;
    const shippingRecipient = partySchema.safeParse(shippingCandidate);
    const payload = mapper.map(approved.canonicalDocument, {
      supplier,
      buyer,
      business,
      ...(shippingRecipient.success ? { shippingRecipient: shippingRecipient.data } : {}),
      supplementalFields: approved.supplementalFields,
    });
    const unsignedPayload = canonicalSerializeMyInvoisPayload(payload);
    const payloadSizeBytes = Buffer.byteLength(unsignedPayload, "utf8");
    if (payloadSizeBytes > MYINVOIS_MAX_DOCUMENT_BYTES) {
      throw new EInvoicePayloadGenerationError(
        "payload.too_large",
        `Unsigned payload is ${payloadSizeBytes} bytes; the MyInvois document limit is ${MYINVOIS_MAX_DOCUMENT_BYTES} bytes.`,
      );
    }
    const unsignedPayloadHash = createHash("sha256").update(unsignedPayload, "utf8").digest("hex");
    return this.snapshots.persistImmutable({
      ...exactKey,
      unsignedPayload,
      unsignedPayloadHash,
      payloadSizeBytes,
      generatedAt,
    });
  }
}
