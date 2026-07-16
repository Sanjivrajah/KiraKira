import { z } from "zod";
import {
  businessIdSchema,
  isoDateSchema,
  isoDateTimeSchema,
  sourceDocumentIdSchema,
  userIdSchema,
} from "../common";

export const fileHashSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: z.string().regex(/^[a-f0-9]{64}$/i, "Use a 64-character SHA-256 digest."),
  })
  .strict();

export const duplicateDetectionFieldsSchema = z
  .object({
    contentHash: fileHashSchema.optional(),
    externalSourceId: z.string().trim().min(1).max(200).optional(),
    sourceAccountReference: z.string().trim().min(1).max(200).optional(),
  })
  .strict();

const optionalText = (maximum: number) => z.string().trim().min(1).max(maximum).optional();

const sourceDocumentBaseShape = {
  id: sourceDocumentIdSchema,
  businessId: businessIdSchema,
  originalFilename: optionalText(255),
  mimeType: z
    .string()
    .regex(/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i, "Use a valid MIME type.")
    .optional(),
  objectStoragePath: optionalText(1000),
  fileSizeBytes: z.number().int().nonnegative().optional(),
  fileHash: fileHashSchema.optional(),
  rawText: optionalText(1_000_000),
  sourceMessageReference: optionalText(500),
  capturedAt: isoDateTimeSchema,
  uploadedAt: isoDateTimeSchema.optional(),
  processingStatus: z.enum([
    "received",
    "queued",
    "processing",
    "needs_review",
    "processed",
    "failed",
  ]),
  failureReason: optionalText(1000),
  duplicateDetection: duplicateDetectionFieldsSchema.default({}),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  createdBy: userIdSchema.optional(),
  updatedBy: userIdSchema.optional(),
  version: z.number().int().nonnegative().optional(),
};

const manualMetadataSchema = z
  .object({ entryChannel: z.enum(["web", "mobile", "import"]).optional() })
  .strict();

const receiptMetadataSchema = z
  .object({
    imageWidth: z.number().int().positive().optional(),
    imageHeight: z.number().int().positive().optional(),
    pageCount: z.number().int().positive().optional(),
    captureDevice: optionalText(200),
  })
  .strict();

const voiceMetadataSchema = z
  .object({
    durationMilliseconds: z.number().int().nonnegative().optional(),
    languageCode: z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/).optional(),
    audioCodec: optionalText(50),
  })
  .strict();

const whatsAppMetadataSchema = z
  .object({
    chatReference: optionalText(200),
    senderReference: optionalText(200),
    messageTimestamp: isoDateTimeSchema.optional(),
  })
  .strict();

const csvMetadataSchema = z
  .object({
    delimiter: z.string().min(1).max(4).optional(),
    encoding: optionalText(50),
    rowCount: z.number().int().nonnegative().optional(),
  })
  .strict();

const bankStatementMetadataSchema = z
  .object({
    bankName: optionalText(200),
    accountLastFour: z.string().regex(/^\d{4}$/).optional(),
    statementPeriodStart: isoDateSchema.optional(),
    statementPeriodEnd: isoDateSchema.optional(),
  })
  .strict();

const externalSystemMetadataSchema = z
  .object({
    systemName: z.string().trim().min(1).max(100),
    recordType: optionalText(100),
    sourceUrl: z.url().optional(),
  })
  .strict();

const sourceDocumentVariants = [
  z.object({ ...sourceDocumentBaseShape, sourceType: z.literal("manual"), sourceMetadata: manualMetadataSchema }).strict(),
  z.object({ ...sourceDocumentBaseShape, sourceType: z.literal("receipt"), sourceMetadata: receiptMetadataSchema }).strict(),
  z.object({ ...sourceDocumentBaseShape, sourceType: z.literal("voice"), sourceMetadata: voiceMetadataSchema }).strict(),
  z.object({ ...sourceDocumentBaseShape, sourceType: z.literal("whatsapp"), sourceMetadata: whatsAppMetadataSchema }).strict(),
  z.object({ ...sourceDocumentBaseShape, sourceType: z.literal("csv"), sourceMetadata: csvMetadataSchema }).strict(),
  z.object({ ...sourceDocumentBaseShape, sourceType: z.literal("bank_statement"), sourceMetadata: bankStatementMetadataSchema }).strict(),
  z.object({ ...sourceDocumentBaseShape, sourceType: z.literal("external_system"), sourceMetadata: externalSystemMetadataSchema }).strict(),
] as const;

export const sourceDocumentSchema = z
  .discriminatedUnion("sourceType", sourceDocumentVariants)
  .superRefine((document, context) => {
    if (document.processingStatus === "failed" && !document.failureReason) {
      context.addIssue({
        code: "custom",
        path: ["failureReason"],
        message: "A failed source document requires a failure reason.",
      });
    }

    if (document.processingStatus !== "failed" && document.failureReason) {
      context.addIssue({
        code: "custom",
        path: ["failureReason"],
        message: "Failure reason is only valid for failed source documents.",
      });
    }
  });
