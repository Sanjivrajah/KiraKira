import { describe, expect, it } from "vitest";
import {
  UBL_FIXTURE_BUYER,
  UBL_FIXTURE_SUPPLIER,
  UBL_STANDARD_B2B_INVOICE,
} from "@/compliance/myinvois/fixtures";
import type {
  EInvoicePayloadSnapshotRecord,
  EInvoicePayloadSnapshotRepository,
  EInvoicePreparationRecord,
  PersistEInvoicePayloadSnapshotInput,
} from "./contracts";
import {
  GenerateEInvoicePayloadSnapshotService,
  MYINVOIS_MAX_DOCUMENT_BYTES,
} from "./payload-snapshot-service";

function approvedRecord(overrides: Partial<EInvoicePreparationRecord> = {}): EInvoicePreparationRecord {
  return {
    id: "e_invoice_document_001",
    businessId: UBL_STANDARD_B2B_INVOICE.businessId,
    sourceInvoiceId: "source_invoice_001",
    sourceInvoiceRevision: 4,
    documentType: "invoice",
    documentVersion: "1.0",
    scenario: "b2b_invoice",
    canonicalDocument: UBL_STANDARD_B2B_INVOICE,
    supplierSnapshot: {
      party: UBL_FIXTURE_SUPPLIER,
      msicCode: "01111",
      businessActivityDescription: "Growing of maize",
    },
    buyerSnapshot: UBL_FIXTURE_BUYER,
    supplementalFields: {},
    provenance: [],
    readinessResult: {
      ready: true,
      diagnostics: [],
      validatedAt: "2026-07-17T00:00:00.000Z",
      checkLabel: "NiagaAI internal preparation checks",
    },
    status: "approved",
    revision: 5,
    approvedAt: "2026-07-17T00:00:00.000Z",
    approvedBy: "profile_001",
    active: true,
    submissionEligible: true,
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt: "2026-07-17T00:00:00.000Z",
    ...overrides,
  };
}

class MemoryPayloadRepository implements EInvoicePayloadSnapshotRepository {
  readonly records: EInvoicePayloadSnapshotRecord[] = [];
  constructor(public source: EInvoicePreparationRecord | null = approvedRecord()) {}

  async loadApprovedForGeneration(businessId: string, documentId: string) {
    return this.source?.businessId === businessId && this.source.id === documentId ? this.source : null;
  }

  async findExact(input: Pick<PersistEInvoicePayloadSnapshotInput,
    "businessId" | "eInvoiceDocumentId" | "documentRevision" | "documentVersion" |
    "mapperVersion" | "referenceDataVersion" | "format"
  >) {
    return this.records.find((record) => Object.entries(input).every(([key, value]) => record[key as keyof typeof record] === value)) ?? null;
  }

  async persistImmutable(input: PersistEInvoicePayloadSnapshotInput) {
    const record = { id: `payload_${this.records.length + 1}`, ...input };
    this.records.push(record);
    return record;
  }
}

describe("GenerateEInvoicePayloadSnapshotService", () => {
  it("persists exact deterministic bytes, SHA-256, size, and pinned versions", async () => {
    const repository = new MemoryPayloadRepository();
    const service = new GenerateEInvoicePayloadSnapshotService(repository);
    const first = await service.generate(
      UBL_STANDARD_B2B_INVOICE.businessId,
      "e_invoice_document_001",
      "2026-07-17T12:00:00.000Z",
    );
    const second = await service.generate(
      UBL_STANDARD_B2B_INVOICE.businessId,
      "e_invoice_document_001",
      "2026-07-17T12:05:00.000Z",
    );

    expect(second).toBe(first);
    expect(repository.records).toHaveLength(1);
    expect(first.unsignedPayload).not.toMatch(/\n|\r|  /);
    expect(first.unsignedPayloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.payloadSizeBytes).toBe(Buffer.byteLength(first.unsignedPayload, "utf8"));
    expect(first.payloadSizeBytes).toBeLessThanOrEqual(MYINVOIS_MAX_DOCUMENT_BYTES);
    expect(first).toMatchObject({
      documentRevision: 5,
      documentVersion: "1.0",
      mapperVersion: "invoice-v1.0.4",
      referenceDataVersion: "myinvois-sdk-2026-07-17",
      format: "json",
    });
  });

  it.each([
    { active: false, submissionEligible: false },
    { status: "ready" as const, submissionEligible: false },
  ])("rejects a superseded or unapproved preparation", async (overrides) => {
    const service = new GenerateEInvoicePayloadSnapshotService(new MemoryPayloadRepository(approvedRecord(overrides)));
    await expect(service.generate(
      UBL_STANDARD_B2B_INVOICE.businessId,
      "e_invoice_document_001",
      "2026-07-17T12:00:00.000Z",
    )).rejects.toMatchObject({ code: "document.not_eligible" });
  });

  it("generates an unsigned v1.0 snapshot for sandbox submission", async () => {
    const repository = new MemoryPayloadRepository();
    const snapshot = await new GenerateEInvoicePayloadSnapshotService(repository).generate(
      UBL_STANDARD_B2B_INVOICE.businessId,
      "e_invoice_document_001",
      "2026-07-17T12:00:00.000Z",
    );
    expect(snapshot).toMatchObject({ documentVersion: "1.0", mapperVersion: "invoice-v1.0.4" });
    expect(JSON.parse(snapshot.unsignedPayload).Invoice[0].InvoiceTypeCode[0].listVersionID).toBe("1.0");
  });

  it("rejects an approved historical v1.1 preparation safely", async () => {
    const historical = approvedRecord({ documentVersion: "unsupported_historical" });
    const service = new GenerateEInvoicePayloadSnapshotService(new MemoryPayloadRepository(historical));
    await expect(service.generate(
      UBL_STANDARD_B2B_INVOICE.businessId,
      "e_invoice_document_001",
      "2026-07-17T12:00:00.000Z",
    )).rejects.toMatchObject({ code: "document.unsupported_historical_version" });
  });

  it("re-runs readiness and reports structured failures", async () => {
    const source = approvedRecord({ buyerSnapshot: { ...UBL_FIXTURE_BUYER, taxIdentifiers: [] } });
    const service = new GenerateEInvoicePayloadSnapshotService(new MemoryPayloadRepository(source));
    await expect(service.generate(
      UBL_STANDARD_B2B_INVOICE.businessId,
      "e_invoice_document_001",
      "2026-07-17T12:00:00.000Z",
    )).rejects.toMatchObject({
      code: "document.readiness_failed",
      diagnostics: expect.arrayContaining([expect.objectContaining({ fieldPath: "buyer.taxIdentifiers" })]),
    });
  });
});
