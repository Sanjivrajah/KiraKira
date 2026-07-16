import { describe, expect, it } from "vitest";
import { DEMO_SOURCE_EXTRACTIONS } from "@/data/demo";
import { extractionRunSchema, isoDateTimeSchema } from "@/domain";
import { loadTransactionProvenance, persistReviewProvenance } from "@/frontend/storage";
import { BrowserStorage } from "@/lib/storage/browser-storage";
import { approveExtractionRun, deriveApprovalAuditTimeline } from "./approval-audit";
import { transactionReviewToDomain } from "./transaction-review";

const receiptFixture = DEMO_SOURCE_EXTRACTIONS.find(({ sourceDocument }) => sourceDocument.sourceType === "receipt")!;

const reviewedReceipt = {
  type: "expense" as const,
  date: "2026-07-13",
  amount: 86.4,
  category: "Inventory",
  description: "Cooking ingredients and packaging",
  counterpartyName: "Maju Mart",
  paymentMethod: "Debit card",
};

function memoryStorage() {
  const values = new Map<string, string>();
  const storage: Storage = {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
  return new BrowserStorage(() => storage);
}

describe("transaction review provenance", () => {
  it("does not report decimal formatting as an owner correction", () => {
    const approved = approveExtractionRun(receiptFixture.extractionRun, reviewedReceipt, {
      reviewedBy: "demo-lina",
      reviewedAt: "2026-07-14T08:10:00.000Z",
    });

    expect(approved.changedFields).toEqual([]);
  });

  it("preserves source and extraction links on the confirmed transaction", () => {
    const transaction = transactionReviewToDomain({
      ...reviewedReceipt,
      source: "receipt",
      eInvoiceTreatment: "undetermined",
      fieldConfidence: {},
    }, {
      id: "transaction_audit_demo",
      businessId: "business_demo",
      userId: "demo-lina",
      now: "2026-07-14T08:10:00.000Z",
      extractionRun: receiptFixture.extractionRun,
    });

    expect(transaction.sourceLinks).toEqual([{
      sourceDocumentId: receiptFixture.sourceDocument.id,
      extractionRunId: receiptFixture.extractionRun.id,
      relationship: "primary",
    }]);
    expect(transaction.confidenceScore).toBeCloseTo(0.95);

    const storage = memoryStorage();
    persistReviewProvenance(receiptFixture.sourceDocument, receiptFixture.extractionRun, storage);
    expect(loadTransactionProvenance(transaction, storage)).toEqual([{
      sourceDocument: receiptFixture.sourceDocument,
      extractionRun: receiptFixture.extractionRun,
      relationship: "primary",
    }]);
  });

  it("records exact owner corrections and derives an ordered audit timeline", () => {
    const proposedWithWrongTotal = extractionRunSchema.parse({
      ...receiptFixture.extractionRun,
      normalizedProposedResult: {
        ...receiptFixture.extractionRun.normalizedProposedResult,
        total: { amount: "68.40" as const, currency: "MYR" as const },
      },
      fields: receiptFixture.extractionRun.fields.map((field) => field.fieldPath === "total.amount"
        ? { ...field, normalizedValue: "68.40" }
        : field),
    });
    const approved = approveExtractionRun(proposedWithWrongTotal, reviewedReceipt, {
      reviewedBy: "demo-lina",
      reviewedAt: "2026-07-14T08:10:00.000Z",
    });

    expect(approved.changedFields).toEqual([{
      fieldPath: "total.amount",
      originalValue: "68.40",
      reviewedValue: "86.4",
    }]);
    expect(approved.reviewedBy).toBe("demo-lina");
    expect(approved.reviewedAt).toBe("2026-07-14T08:10:00.000Z");

    const transaction = transactionReviewToDomain({
      ...reviewedReceipt,
      source: "receipt",
      eInvoiceTreatment: "undetermined",
      fieldConfidence: {},
    }, {
      id: "transaction_audit_demo",
      businessId: "business_demo",
      userId: "demo-lina",
      now: "2026-07-14T08:10:00.000Z",
      extractionRun: approved,
    });

    const timeline = deriveApprovalAuditTimeline({
      sourceDocument: receiptFixture.sourceDocument,
      extractionRun: approved,
      transaction,
      checksRerunAt: isoDateTimeSchema.parse("2026-07-14T08:10:01.000Z"),
    });

    expect(timeline.map((event) => event.kind)).toEqual([
      "evidence_received",
      "draft_prepared",
      "field_changed",
      "approved",
      "checks_rerun",
    ]);
    expect(timeline.find((event) => event.kind === "field_changed")?.detail).toBe("68.40 → 86.4");
  });

  it("rejects a timeline assembled from unrelated evidence", () => {
    const voiceFixture = DEMO_SOURCE_EXTRACTIONS.find(({ sourceDocument }) => sourceDocument.sourceType === "voice")!;
    expect(() => deriveApprovalAuditTimeline({
      sourceDocument: voiceFixture.sourceDocument,
      extractionRun: receiptFixture.extractionRun,
    })).toThrow("does not belong");
  });
});
