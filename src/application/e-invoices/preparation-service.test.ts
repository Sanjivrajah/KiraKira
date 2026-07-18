import { describe, expect, it } from "vitest";
import { UBL_FIXTURE_BUYER, UBL_FIXTURE_BUSINESS, UBL_FIXTURE_SUPPLIER, UBL_STANDARD_B2B_INVOICE } from "@/compliance/myinvois";
import type { EInvoiceCandidate, EInvoicePreparationRecord, EInvoicePreparationRepository, EInvoiceSourceRepository } from "./contracts";
import { EInvoicePreparationService, evaluatePreparationReadiness } from "./preparation-service";

const now = "2026-07-17T10:00:00.000Z";

function readyInput() {
  return {
    canonicalDocument: UBL_STANDARD_B2B_INVOICE,
    supplierSnapshot: { party: UBL_FIXTURE_SUPPLIER, msicCode: UBL_FIXTURE_BUSINESS.compliance.msicCode, businessActivityDescription: UBL_FIXTURE_BUSINESS.compliance.businessActivityDescription },
    buyerSnapshot: UBL_FIXTURE_BUYER,
    supplementalFields: {},
    diagnostics: [],
    scenario: "b2b_invoice" as const,
  };
}

function record(overrides: Partial<EInvoicePreparationRecord> = {}): EInvoicePreparationRecord {
  return {
    id: "prepared-1", businessId: "business-1", sourceInvoiceId: "invoice-1", sourceInvoiceRevision: 2,
    documentType: "invoice", documentVersion: "1.0", scenario: "b2b_invoice", canonicalDocument: UBL_STANDARD_B2B_INVOICE,
    supplierSnapshot: readyInput().supplierSnapshot, buyerSnapshot: UBL_FIXTURE_BUYER, supplementalFields: {}, provenance: [],
    readinessResult: evaluatePreparationReadiness(readyInput(), now), status: "ready", revision: 3,
    active: true, submissionEligible: false, createdAt: now, updatedAt: now, ...overrides,
  };
}

describe("EInvoicePreparationService", () => {
  it("uses the existing readiness engine and labels the output as internal checks", () => {
    const readiness = evaluatePreparationReadiness(readyInput(), now);
    expect(readiness.checkLabel).toBe("NiagaAI internal preparation checks");
    expect(readiness.diagnostics).toContainEqual(expect.objectContaining({ severity: "derived", group: "tax" }));
    expect(readiness.diagnostics.some((item) => item.severity === "error")).toBe(false);
  });

  it("blocks approval when matrix-backed B2B fields remain incomplete", () => {
    const input = readyInput();
    const readiness = evaluatePreparationReadiness({ ...input, buyerSnapshot: { ...UBL_FIXTURE_BUYER, phone: undefined } }, now);
    expect(readiness.ready).toBe(false);
    expect(readiness.diagnostics).toContainEqual(expect.objectContaining({ fieldPath: "buyer.phone", severity: "error" }));
  });

  it("blocks unverified scenarios before approval", () => {
    const readiness = evaluatePreparationReadiness({ ...readyInput(), scenario: "foreign_buyer" }, now);
    expect(readiness.ready).toBe(false);
    expect(readiness.diagnostics).toContainEqual(expect.objectContaining({ code: "scenario.not_verified", group: "scenario" }));
  });

  it("keeps approved source revisions visible but ineligible for duplicate preparation", async () => {
    const candidate: EInvoiceCandidate = { id: "invoice-1", invoiceNumber: "INV-1", documentType: "invoice", issueDate: "2026-07-17", currency: "MYR", paymentStatus: "sent", revision: 2, eligible: true, ineligibilityReasons: [] };
    const preparation = record({ status: "approved", submissionEligible: true });
    const repository = {
      listCandidates: async () => [candidate], listPreparations: async () => [preparation],
    } as unknown as EInvoicePreparationRepository;
    const service = new EInvoicePreparationService({} as EInvoiceSourceRepository, repository);
    const workspace = await service.workspace("business-1");
    expect(workspace.candidates[0]).toMatchObject({ eligible: false, preparationStatus: "approved" });
    expect(workspace.candidates[0].ineligibilityReasons[0]).toContain("approved");
  });

  it("does not surface an inactive historical revision as the active workspace item", async () => {
    const repository = {
      listCandidates: async () => [], listPreparations: async () => [record({ active: false, status: "approved" }), record({ id: "prepared-2", status: "ready" })],
    } as unknown as EInvoicePreparationRepository;
    const service = new EInvoicePreparationService({} as EInvoiceSourceRepository, repository);
    const workspace = await service.workspace("business-1");
    expect(workspace.counts).toMatchObject({ ready: 1, approved: 1 });
  });
});
