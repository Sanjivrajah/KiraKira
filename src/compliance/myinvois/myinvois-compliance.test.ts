import { describe, expect, it } from "vitest";
import {
  businessDomainSchema,
  commercialDocumentSchema,
  documentLineSchema,
  groupDocumentTaxes,
  isoDateSchema,
  isoDateTimeSchema,
  partySchema,
  type CommercialDocument,
} from "@/domain";
import { DEMO_COMMERCIAL_DOCUMENTS } from "@/data/demo";
import {
  MYINVOIS_DEVELOPMENT_REFERENCE_CODES,
  createImmutableMyInvoisSnapshot,
  createMyInvoisReferenceCatalog,
  validateMyInvoisReadiness,
  type MyInvoisValidationContext,
} from ".";

const catalog = createMyInvoisReferenceCatalog(MYINVOIS_DEVELOPMENT_REFERENCE_CODES);
const validatedAt = isoDateTimeSchema.parse("2026-07-14T12:00:00.000Z");
const asOfDate = isoDateSchema.parse("2026-07-14");

const supplier = partySchema.parse({
  id: "party_supplier",
  kind: "business",
  legalName: "Niaga Demo Sdn. Bhd.",
  roles: ["seller", "supplier"],
  taxIdentifiers: [{ scheme: "tin", value: "C2584563222", issuingCountryCode: "MY" }],
  registrationIdentifiers: [{ scheme: "brn", value: "202601012345", issuingCountryCode: "MY" }],
  phone: "+60123456789",
  billingAddress: {
    addressLines: ["1 Jalan Demo"],
    city: "Kuala Lumpur",
    postcode: "50000",
    stateCode: "14",
    countryCode: "MY",
  },
  createdAt: validatedAt,
  updatedAt: validatedAt,
});

const buyer = partySchema.parse({
  id: "party_buyer",
  kind: "business",
  legalName: "Buyer Demo Sdn. Bhd.",
  roles: ["buyer", "customer"],
  taxIdentifiers: [{ scheme: "tin", value: "C2584563200", issuingCountryCode: "MY" }],
  registrationIdentifiers: [{ scheme: "brn", value: "202501012345", issuingCountryCode: "MY" }],
  phone: "+60312345678",
  billingAddress: {
    addressLines: ["2 Jalan Buyer"],
    city: "Shah Alam",
    postcode: "40100",
    stateCode: "10",
    countryCode: "MY",
  },
  createdAt: validatedAt,
  updatedAt: validatedAt,
});

const business = businessDomainSchema.parse({
  id: "business_demo",
  legalName: "Niaga Demo Sdn. Bhd.",
  entityType: "private_limited_company",
  compliance: {
    tin: { scheme: "tin", value: "C2584563222", issuingCountryCode: "MY" },
    registration: { scheme: "brn", value: "202601012345", issuingCountryCode: "MY" },
    sstRegistrations: [],
    msicCode: "01111",
    businessActivityDescription: "Growing of maize",
  },
  contact: { phone: "+60123456789" },
  address: supplier.billingAddress,
  defaultCurrency: "MYR",
  preferredLanguage: "en",
  timezone: "Asia/Kuala_Lumpur",
  createdAt: validatedAt,
  updatedAt: validatedAt,
});

function compliantDocument(): CommercialDocument {
  const base = DEMO_COMMERCIAL_DOCUMENTS[1];
  const line = documentLineSchema.parse({
    ...base.lines[0],
    classificationCode: "022",
    unitCode: "C62",
    taxTreatment: { ...base.lines[0].taxTreatment, taxTypeCode: "06" },
  });
  const taxTotals = groupDocumentTaxes([line]);
  return commercialDocumentSchema.parse({
    ...base,
    id: "document_compliant_b2b",
    supplierPartyId: supplier.id,
    buyerPartyId: buyer.id,
    lines: [line],
    taxTotals,
    paymentInstructions: {
      ...base.paymentInstructions,
      paymentModeCode: "03",
    },
  });
}

function validate(overrides: Partial<MyInvoisValidationContext> = {}) {
  return validateMyInvoisReadiness({
    document: compliantDocument(),
    supplier,
    buyer,
    business,
    scenario: "b2b_invoice",
    referenceData: catalog,
    asOfDate,
    validatedAt,
    documentVersion: "1.0",
    ...overrides,
  });
}

describe("MyInvois readiness scenarios", () => {
  it("accepts a locally valid B2B invoice", () => {
    const result = validate();
    expect(result.bookkeeping.ready).toBe(true);
    expect(result.invoice.ready).toBe(true);
    expect(result.myInvoisSubmission.ready).toBe(true);
    expect(result.allIssues).toEqual([]);
  });

  it("rejects an unsupported document version", () => {
    const result = validate({ documentVersion: "2.0" });
    expect(result.myInvoisSubmission.ready).toBe(false);
    expect(result.allIssues).toContainEqual(expect.objectContaining({
      ruleId: "document.version.active",
      fieldPath: "documentVersion",
    }));
  });

  it("identifies the exact buyer TIN path when missing", () => {
    const buyerWithoutTin = partySchema.parse({ ...buyer, taxIdentifiers: [] });
    const result = validate({ buyer: buyerWithoutTin });
    expect(result.invoice.ready).toBe(true);
    expect(result.myInvoisSubmission.ready).toBe(false);
    expect(result.allIssues).toContainEqual(expect.objectContaining({
      ruleId: "buyer.tin.present",
      fieldPath: "buyer.taxIdentifiers",
      severity: "error",
    }));
  });

  it("supports a consolidated general-public scenario", () => {
    const generalPublic = partySchema.parse({
      id: "party_general_public",
      kind: "general_public",
      legalName: "General Public",
      roles: ["buyer"],
      taxIdentifiers: [],
      registrationIdentifiers: [],
      createdAt: validatedAt,
      updatedAt: validatedAt,
    });
    const document = compliantDocument();
    const consolidatedLines = document.lines.map((line) => ({ ...line, classificationCode: "004" }));
    const result = validate({
      scenario: "consolidated_transaction",
      buyer: generalPublic,
      document: { ...document, buyerPartyId: generalPublic.id, lines: consolidatedLines },
    });
    expect(result.myInvoisSubmission.ready).toBe(true);
  });

  it("supports a foreign buyer with structured foreign identity", () => {
    const foreignBuyer = partySchema.parse({
      id: "party_foreign_buyer",
      kind: "foreign_entity",
      legalName: "Foreign Buyer Pte. Ltd.",
      roles: ["buyer"],
      taxIdentifiers: [{ scheme: "tin", value: "EI00000000030", issuingCountryCode: "MY" }],
      registrationIdentifiers: [{ scheme: "other", value: "UEN2026001", issuingCountryCode: "SG", description: "UEN" }],
      phone: "+6561234567",
      billingAddress: { addressLines: ["1 Market Street"], city: "Singapore", postcode: "048946", countryCode: "SG" },
      createdAt: validatedAt,
      updatedAt: validatedAt,
    });
    expect(validate({ scenario: "foreign_buyer", buyer: foreignBuyer }).myInvoisSubmission.ready).toBe(true);
  });

  it("supports a self-billed document scenario", () => {
    const document = { ...compliantDocument(), documentType: "self_billed_invoice" as const };
    expect(validate({ scenario: "self_billed_invoice", document }).myInvoisSubmission.ready).toBe(true);
  });

  it("rejects a credit note with no original reference", () => {
    const document = { ...compliantDocument(), documentType: "credit_note" as const, references: [] };
    const result = validate({ scenario: "credit_note", document });
    expect(result.invoice.ready).toBe(false);
    expect(result.allIssues).toContainEqual(expect.objectContaining({
      ruleId: "document.adjustment-reference.required",
      fieldPath: "document.references",
    }));
  });
});

describe("reference data validation", () => {
  it("rejects a supplier state name before it can reach UBL", () => {
    const supplierWithStateName = partySchema.parse({
      ...supplier,
      billingAddress: { ...supplier.billingAddress!, stateCode: "Selangor" },
    });
    const result = validate({ supplier: supplierWithStateName });
    expect(result.allIssues).toContainEqual(expect.objectContaining({
      ruleId: "supplier.address.valid",
      fieldPath: "supplier.billingAddress.stateCode",
    }));
  });

  it("rejects state 17 for a standard Malaysian buyer", () => {
    const buyerWithNotApplicableState = partySchema.parse({
      ...buyer,
      billingAddress: { ...buyer.billingAddress!, stateCode: "17" },
    });
    const result = validate({ buyer: buyerWithNotApplicableState });
    expect(result.allIssues).toContainEqual(expect.objectContaining({
      ruleId: "buyer.address.valid",
      fieldPath: "buyer.billingAddress.stateCode",
    }));
  });

  it("rejects an unknown tax code at its line path", () => {
    const document = compliantDocument();
    const lines = document.lines.map((line) => ({
      ...line,
      taxTreatment: { ...line.taxTreatment, taxTypeCode: "99" },
    }));
    const result = validate({ document: { ...document, lines } });
    expect(result.allIssues).toContainEqual(expect.objectContaining({
      ruleId: "tax.type.active",
      fieldPath: "document.lines[0].taxTreatment.taxTypeCode",
    }));
  });

  it("rejects an inactive reference code", () => {
    const inactiveEntries = MYINVOIS_DEVELOPMENT_REFERENCE_CODES.map((entry) =>
      entry.codeSet === "classification" && entry.code === "022" ? { ...entry, active: false } : entry,
    );
    const result = validate({ referenceData: createMyInvoisReferenceCatalog(inactiveEntries) });
    expect(result.allIssues).toContainEqual(expect.objectContaining({ ruleId: "line.classification.active" }));
  });

  it("keeps grouped readiness results instead of one percentage", () => {
    const result = validate({ buyer: partySchema.parse({ ...buyer, taxIdentifiers: [] }) });
    expect(result).toHaveProperty("bookkeeping.ready", true);
    expect(result).toHaveProperty("invoice.ready", true);
    expect(result).toHaveProperty("myInvoisSubmission.ready", false);
    expect(result).not.toHaveProperty("percentage");
  });
});

describe("MyInvois immutable snapshots", () => {
  it("deep-freezes the payload and snapshot metadata", () => {
    const snapshot = createImmutableMyInvoisSnapshot({
      id: "snapshot_001",
      commercialDocumentId: compliantDocument().id,
      documentTypeCode: "01",
      documentVersion: "1.0",
      format: "json",
      unsignedPayload: { Invoice: [{ ID: [{ _: "INV-001" }] }] },
      payloadHash: "a".repeat(64),
      generatedAt: validatedAt,
      mapperVersion: "mapper-placeholder-v0",
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.unsignedPayload)).toBe(true);
    expect(() => {
      (snapshot.unsignedPayload as { Invoice: unknown[] }).Invoice.push({});
    }).toThrow();
  });
});
