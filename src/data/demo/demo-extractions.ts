import { extractionRunSchema, sourceDocumentSchema } from "@/domain";

const TIMESTAMP = "2026-07-14T08:00:00.000Z";

function sourceBase(id: string, capturedAt = TIMESTAMP) {
  return {
    id,
    businessId: "business_demo",
    capturedAt,
    uploadedAt: capturedAt,
    processingStatus: "needs_review" as const,
    duplicateDetection: {},
    createdAt: capturedAt,
    updatedAt: capturedAt,
    createdBy: "demo-lina",
  };
}

function extractionBase(
  id: string,
  sourceDocumentId: string,
  normalizedProposedResult: Record<string, unknown>,
  fields: Array<Record<string, unknown>>,
  rawProviderResult: Record<string, unknown>,
) {
  return {
    id,
    sourceDocumentId,
    extractionVersion: "1.0.0",
    provider: "niagaai-demo",
    modelName: "deterministic-fixture",
    promptOrPipelineVersion: "demo-source-v1",
    rawProviderResult,
    normalizedProposedResult,
    fields,
    warnings: [],
    overallConfidence: 0.9,
    status: "needs_review" as const,
    startedAt: TIMESTAMP,
    completedAt: TIMESTAMP,
    changedFields: [],
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    createdBy: "demo-lina",
  };
}

const receiptSource = sourceDocumentSchema.parse({
  ...sourceBase("source_demo_receipt"),
  sourceType: "receipt",
  originalFilename: "maju-mart-receipt.jpg",
  mimeType: "image/jpeg",
  objectStoragePath: "pending://source_demo_receipt",
  fileSizeBytes: 184_320,
  fileHash: { algorithm: "sha256", value: "a".repeat(64) },
  duplicateDetection: {
    contentHash: { algorithm: "sha256", value: "a".repeat(64) },
  },
  sourceMetadata: { imageWidth: 1200, imageHeight: 1800, pageCount: 1 },
});

const receiptExtraction = extractionRunSchema.parse(
  extractionBase(
    "extraction_demo_receipt",
    receiptSource.id,
    {
      direction: "expense",
      transactionDate: "2026-07-13",
      counterpartyName: "Maju Mart",
      description: "Cooking ingredients and packaging",
      category: "Inventory",
      currency: "MYR",
      total: { amount: "86.40", currency: "MYR" },
      paymentMethod: "Debit card",
    },
    [
      {
        fieldPath: "counterpartyName",
        originalText: "MAJU MART",
        normalizedValue: "Maju Mart",
        confidence: 0.96,
        evidenceText: "MAJU MART",
        pageNumber: 1,
        boundingBox: { x: 0.12, y: 0.08, width: 0.4, height: 0.05, unit: "normalized" },
      },
      {
        fieldPath: "total.amount",
        originalText: "TOTAL RM 86.40",
        normalizedValue: "86.40",
        confidence: 0.94,
        evidenceText: "TOTAL RM 86.40",
        pageNumber: 1,
      },
    ],
    { merchant: "MAJU MART", total: 86.4 },
  ),
);

const voiceSource = sourceDocumentSchema.parse({
  ...sourceBase("source_demo_voice"),
  sourceType: "voice",
  originalFilename: "inventory-note.m4a",
  mimeType: "audio/mp4",
  objectStoragePath: "pending://source_demo_voice",
  fileSizeBytes: 91_200,
  rawText: "Today I bought 20 boxes of mineral water for RM240 from ABC Supplier.",
  sourceMetadata: { durationMilliseconds: 8_400, languageCode: "en-MY", audioCodec: "aac" },
});

const voiceExtraction = extractionRunSchema.parse(
  extractionBase(
    "extraction_demo_voice",
    voiceSource.id,
    {
      direction: "expense",
      counterpartyName: "ABC Supplier",
      description: "20 boxes of mineral water",
      category: "Inventory",
      currency: "MYR",
      total: { amount: "240", currency: "MYR" },
    },
    [
      {
        fieldPath: "total.amount",
        originalText: "RM240",
        normalizedValue: "240",
        confidence: 0.92,
        evidenceText: "for RM240",
        audioTimestampRange: { startMilliseconds: 3_900, endMilliseconds: 5_100 },
      },
    ],
    { transcript: voiceSource.rawText },
  ),
);

const csvSource = sourceDocumentSchema.parse({
  ...sourceBase("source_demo_csv"),
  sourceType: "csv",
  originalFilename: "july-expenses.csv",
  mimeType: "text/csv",
  objectStoragePath: "pending://source_demo_csv",
  fileSizeBytes: 2_048,
  sourceMetadata: { delimiter: ",", encoding: "utf-8", rowCount: 12 },
});

const csvExtraction = extractionRunSchema.parse(
  extractionBase(
    "extraction_demo_csv",
    csvSource.id,
    {
      direction: "expense",
      transactionDate: "2026-07-10",
      counterpartyName: "CelcomDigi",
      description: "Mobile and internet bill",
      category: "Utilities",
      currency: "MYR",
      total: { amount: "78", currency: "MYR" },
      paymentMethod: "Auto debit",
    },
    [{ fieldPath: "total.amount", originalText: "78.00", normalizedValue: "78", confidence: 0.99, evidenceText: "CSV row 4, amount column" }],
    { rowNumber: 4, amount: "78.00", merchant: "CelcomDigi" },
  ),
);

const bankStatementSource = sourceDocumentSchema.parse({
  ...sourceBase("source_demo_bank"),
  sourceType: "bank_statement",
  originalFilename: "bank-july-2026.pdf",
  mimeType: "application/pdf",
  objectStoragePath: "pending://source_demo_bank",
  fileSizeBytes: 420_000,
  sourceMetadata: {
    bankName: "Demo Bank",
    accountLastFour: "1024",
    statementPeriodStart: "2026-07-01",
    statementPeriodEnd: "2026-07-31",
  },
});

const bankStatementExtraction = extractionRunSchema.parse(
  extractionBase(
    "extraction_demo_bank",
    bankStatementSource.id,
    {
      direction: "income",
      transactionDate: "2026-07-09",
      counterpartyName: "Teras Digital",
      description: "Office lunch order",
      category: "Sales",
      currency: "MYR",
      total: { amount: "620", currency: "MYR" },
      paymentMethod: "Bank transfer",
    },
    [{ fieldPath: "total.amount", originalText: "CR 620.00", normalizedValue: "620", confidence: 0.95, evidenceText: "Statement row 18", pageNumber: 2 }],
    { page: 2, row: 18, credit: "620.00", narrative: "TERAS DIGITAL" },
  ),
);

const whatsAppSource = sourceDocumentSchema.parse({
  ...sourceBase("source_demo_whatsapp", "2026-07-12T06:20:00.000Z"),
  sourceType: "whatsapp",
  rawText: "Hi Kak Lina, can I order 40 lunch boxes for Friday? Total RM850. I’ll transfer the deposit today.",
  sourceMessageReference: "whatsapp-message-demo-001",
  duplicateDetection: {
    externalSourceId: "wamid.demo.001",
    sourceAccountReference: "whatsapp-business-demo",
  },
  sourceMetadata: {
    chatReference: "chat-suria-events",
    senderReference: "contact-suria-events",
    messageTimestamp: "2026-07-12T06:20:00.000Z",
  },
});

const whatsAppExtraction = extractionRunSchema.parse(
  extractionBase(
    "extraction_demo_whatsapp",
    whatsAppSource.id,
    {
      direction: "income",
      counterpartyName: "Suria Events",
      description: "Catering deposit for 40 lunch boxes",
      category: "Catering",
      currency: "MYR",
      total: { amount: "850", currency: "MYR" },
      paymentMethod: "Bank transfer",
    },
    [{ fieldPath: "total.amount", originalText: "RM850", normalizedValue: "850", confidence: 0.97, evidenceText: "Total RM850" }],
    { message: whatsAppSource.rawText },
  ),
);

export const DEMO_SOURCE_EXTRACTIONS = [
  { sourceDocument: receiptSource, extractionRun: receiptExtraction },
  { sourceDocument: voiceSource, extractionRun: voiceExtraction },
  { sourceDocument: csvSource, extractionRun: csvExtraction },
  { sourceDocument: bankStatementSource, extractionRun: bankStatementExtraction },
  { sourceDocument: whatsAppSource, extractionRun: whatsAppExtraction },
];
