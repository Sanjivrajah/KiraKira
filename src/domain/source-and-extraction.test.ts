import { describe, expect, it } from "vitest";
import { DEMO_SOURCE_EXTRACTIONS } from "@/data/demo/demo-extractions";
import {
  extractionRunSchema,
  extractedFieldSchema,
  sourceDocumentSchema,
  type SourceDocumentType,
} from ".";

const TIMESTAMP = "2026-07-14T08:00:00.000Z";

function sourceInput(sourceType: SourceDocumentType) {
  const metadata = {
    manual: { entryChannel: "web" },
    receipt: { imageWidth: 1200, imageHeight: 1800, pageCount: 1 },
    voice: { durationMilliseconds: 8_400, languageCode: "en-MY" },
    whatsapp: { chatReference: "chat-001", messageTimestamp: TIMESTAMP },
    csv: { delimiter: ",", encoding: "utf-8", rowCount: 12 },
    bank_statement: { bankName: "Demo Bank", accountLastFour: "1024" },
    external_system: { systemName: "Demo POS", recordType: "sale" },
  }[sourceType];

  return {
    id: `source_${sourceType}`,
    businessId: "business_demo",
    sourceType,
    sourceMetadata: metadata,
    capturedAt: TIMESTAMP,
    processingStatus: "received",
    duplicateDetection: {},
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };
}

function extractionInput(overrides: Record<string, unknown> = {}) {
  return {
    id: "extraction_test_001",
    sourceDocumentId: "source_receipt",
    extractionVersion: "1.0.0",
    provider: "niagaai-demo",
    modelName: "deterministic-fixture",
    promptOrPipelineVersion: "receipt-v1",
    rawProviderResult: { merchant: null, total: null },
    normalizedProposedResult: {},
    fields: [],
    warnings: [],
    overallConfidence: 0.4,
    status: "needs_review",
    startedAt: TIMESTAMP,
    completedAt: TIMESTAMP,
    changedFields: [],
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  };
}

describe("source document contracts", () => {
  it.each<SourceDocumentType>([
    "manual",
    "receipt",
    "voice",
    "whatsapp",
    "csv",
    "bank_statement",
    "external_system",
  ])("accepts the %s source type", (sourceType) => {
    expect(sourceDocumentSchema.safeParse(sourceInput(sourceType)).success).toBe(true);
  });

  it("preserves image metadata without storing binary data", () => {
    const receipt = DEMO_SOURCE_EXTRACTIONS.find(
      ({ sourceDocument }) => sourceDocument.sourceType === "receipt",
    )?.sourceDocument;

    expect(receipt).toMatchObject({
      sourceType: "receipt",
      mimeType: "image/jpeg",
      fileSizeBytes: 184_320,
      sourceMetadata: { imageWidth: 1200, imageHeight: 1800, pageCount: 1 },
    });
    expect(receipt).not.toHaveProperty("bytes");
    expect(receipt).not.toHaveProperty("binary");
  });

  it("preserves duplicate detection hashes and external message identifiers", () => {
    const receipt = sourceDocumentSchema.parse({
      ...sourceInput("receipt"),
      fileHash: { algorithm: "sha256", value: "a".repeat(64) },
      duplicateDetection: {
        contentHash: { algorithm: "sha256", value: "b".repeat(64) },
        externalSourceId: "receipt-upload-001",
        sourceAccountReference: "device-account-01",
      },
    });

    expect(receipt.fileHash?.value).toHaveLength(64);
    expect(receipt.duplicateDetection.contentHash?.value).toHaveLength(64);
    expect(receipt.duplicateDetection.externalSourceId).toBe("receipt-upload-001");
  });

  it("requires a reason only when processing failed", () => {
    expect(
      sourceDocumentSchema.safeParse({
        ...sourceInput("csv"),
        processingStatus: "failed",
      }).success,
    ).toBe(false);
    expect(
      sourceDocumentSchema.safeParse({
        ...sourceInput("csv"),
        processingStatus: "failed",
        failureReason: "The CSV encoding could not be detected.",
      }).success,
    ).toBe(true);
  });
});

describe("extraction evidence and proposal contracts", () => {
  it("supports timestamp evidence for voice extraction", () => {
    const voice = DEMO_SOURCE_EXTRACTIONS.find(
      ({ sourceDocument }) => sourceDocument.sourceType === "voice",
    );
    const amountField = voice?.extractionRun.fields.find(
      (field) => field.fieldPath === "total.amount",
    );

    expect(amountField?.audioTimestampRange).toEqual({
      startMilliseconds: 3_900,
      endMilliseconds: 5_100,
    });
    expect(
      extractedFieldSchema.safeParse({
        fieldPath: "total.amount",
        normalizedValue: "240",
        confidence: 0.8,
        audioTimestampRange: { startMilliseconds: 5_100, endMilliseconds: 3_900 },
      }).success,
    ).toBe(false);
  });

  it("accepts extraction proposals with missing fields", () => {
    const extraction = extractionRunSchema.parse(
      extractionInput({
        rawProviderResult: { merchant: null, total: null, text: "faded receipt" },
        normalizedProposedResult: { direction: "expense" },
        fields: [
          {
            fieldPath: "counterpartyName",
            originalText: "",
            normalizedValue: null,
            confidence: 0.1,
            evidenceText: "Supplier line is unreadable",
            pageNumber: 1,
          },
        ],
      }),
    );

    expect(extraction.normalizedProposedResult).toEqual({ direction: "expense" });
    expect(extraction.fields[0].normalizedValue).toBeNull();
    expect(extraction.rawProviderResult).not.toEqual(extraction.normalizedProposedResult);
  });

  it("records structured low-confidence warnings", () => {
    const result = extractionRunSchema.parse(
      extractionInput({
        warnings: [
          {
            code: "low_confidence_classification",
            severity: "warning",
            fieldPath: "direction",
            message: "The direction could not be classified reliably.",
            suggestedAction: "Choose income or expense during review.",
          },
        ],
      }),
    );

    expect(result.warnings[0]).toMatchObject({
      code: "low_confidence_classification",
      severity: "warning",
    });
  });

  it.each(["approved", "rejected"] as const)("captures the %s review state", (status) => {
    const result = extractionRunSchema.parse(
      extractionInput({
        status,
        reviewedBy: "user_reviewer",
        reviewedAt: "2026-07-14T08:10:00.000Z",
        reviewerNotes: status === "approved" ? "Checked against source." : "Not a business transaction.",
        changedFields:
          status === "approved"
            ? [{ fieldPath: "category", originalValue: "Other", reviewedValue: "Inventory" }]
            : [],
      }),
    );

    expect(result.status).toBe(status);
    expect(result.reviewedBy).toBe("user_reviewer");
  });

  it("does not allow approval without reviewer audit fields", () => {
    expect(
      extractionRunSchema.safeParse(extractionInput({ status: "approved" })).success,
    ).toBe(false);
  });

  it("represents all existing non-manual mock extraction paths as source/run pairs", () => {
    expect(DEMO_SOURCE_EXTRACTIONS.map(({ sourceDocument }) => sourceDocument.sourceType)).toEqual([
      "receipt",
      "voice",
      "csv",
      "bank_statement",
      "whatsapp",
    ]);
    expect(
      DEMO_SOURCE_EXTRACTIONS.every(
        ({ sourceDocument, extractionRun }) =>
          extractionRun.sourceDocumentId === sourceDocument.id &&
          extractionRun.status === "needs_review",
      ),
    ).toBe(true);
  });
});
