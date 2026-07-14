import { z } from "zod";
import {
  currencyCodeSchema,
  decimalStringSchema,
  extractionRunIdSchema,
  isoDateSchema,
  isoDateTimeSchema,
  moneyValueSchema,
  sourceDocumentIdSchema,
  userIdSchema,
} from "../common";

export const confidenceScoreSchema = z.number().min(0).max(1);
export const fieldPathSchema = z
  .string()
  .trim()
  .min(1)
  .max(250)
  .regex(
    /^[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*|\[\d+\])*$/,
    "Use a dotted field path with optional array indexes.",
  );

export const boundingBoxSchema = z
  .object({
    x: z.number().nonnegative(),
    y: z.number().nonnegative(),
    width: z.number().positive(),
    height: z.number().positive(),
    unit: z.enum(["pixels", "normalized"]),
  })
  .strict()
  .superRefine((box, context) => {
    if (box.unit === "normalized" && Math.max(box.x, box.y, box.width, box.height) > 1) {
      context.addIssue({
        code: "custom",
        message: "Normalized bounding-box values must be between 0 and 1.",
      });
    }
  });

export const audioTimestampRangeSchema = z
  .object({
    startMilliseconds: z.number().int().nonnegative(),
    endMilliseconds: z.number().int().nonnegative(),
  })
  .strict()
  .refine((range) => range.endMilliseconds >= range.startMilliseconds, {
    path: ["endMilliseconds"],
    message: "Audio evidence cannot end before it starts.",
  });

export const extractedFieldSchema = z
  .object({
    fieldPath: fieldPathSchema,
    originalText: z.string().max(10_000).optional(),
    normalizedValue: z.json(),
    confidence: confidenceScoreSchema,
    evidenceText: z.string().max(10_000).optional(),
    pageNumber: z.number().int().positive().optional(),
    boundingBox: boundingBoxSchema.optional(),
    audioTimestampRange: audioTimestampRangeSchema.optional(),
  })
  .strict();

export const extractionWarningSchema = z
  .object({
    code: z.enum([
      "missing_supplier_name",
      "unreadable_total",
      "conflicting_invoice_date",
      "tax_total_mismatch",
      "duplicate_candidate",
      "unsupported_currency",
      "low_confidence_classification",
      "other",
    ]),
    severity: z.enum(["info", "warning", "error"]),
    fieldPath: fieldPathSchema.optional(),
    message: z.string().trim().min(1).max(1000),
    suggestedAction: z.string().trim().min(1).max(1000),
  })
  .strict();

export const proposedTransactionLineSchema = z
  .object({
    description: z.string().trim().min(1).max(500).optional(),
    quantity: decimalStringSchema.optional(),
    unitPrice: moneyValueSchema.optional(),
    amount: moneyValueSchema.optional(),
  })
  .strict();

export const proposedTransactionSchema = z
  .object({
    direction: z.enum(["income", "expense", "unknown"]).optional(),
    transactionDate: isoDateSchema.optional(),
    counterpartyName: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().min(1).max(1000).optional(),
    category: z.string().trim().min(1).max(200).optional(),
    currency: currencyCodeSchema.optional(),
    subtotal: moneyValueSchema.optional(),
    tax: moneyValueSchema.optional(),
    total: moneyValueSchema.optional(),
    paymentMethod: z.string().trim().min(1).max(100).optional(),
    lineItems: z.array(proposedTransactionLineSchema).max(1000).optional(),
  })
  .strict();

export const reviewedFieldChangeSchema = z
  .object({
    fieldPath: fieldPathSchema,
    originalValue: z.json(),
    reviewedValue: z.json(),
  })
  .strict();

const reviewableStatuses = new Set(["extracted", "needs_review", "approved", "rejected", "superseded"]);

export const extractionRunSchema = z
  .object({
    id: extractionRunIdSchema,
    sourceDocumentId: sourceDocumentIdSchema,
    extractionVersion: z.string().trim().min(1).max(100),
    provider: z.string().trim().min(1).max(100),
    modelName: z.string().trim().min(1).max(200),
    promptOrPipelineVersion: z.string().trim().min(1).max(200),
    rawProviderResult: z.json(),
    normalizedProposedResult: proposedTransactionSchema.optional(),
    fields: z.array(extractedFieldSchema).max(10_000).default([]),
    warnings: z.array(extractionWarningSchema).max(1000).default([]),
    overallConfidence: confidenceScoreSchema.optional(),
    status: z.enum([
      "pending",
      "running",
      "failed",
      "extracted",
      "needs_review",
      "approved",
      "rejected",
      "superseded",
    ]),
    failureReason: z.string().trim().min(1).max(1000).optional(),
    startedAt: isoDateTimeSchema,
    completedAt: isoDateTimeSchema.optional(),
    reviewedBy: userIdSchema.optional(),
    reviewedAt: isoDateTimeSchema.optional(),
    reviewerNotes: z.string().trim().min(1).max(2000).optional(),
    changedFields: z.array(reviewedFieldChangeSchema).max(1000).default([]),
    supersededByRunId: extractionRunIdSchema.optional(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
    createdBy: userIdSchema.optional(),
    updatedBy: userIdSchema.optional(),
    version: z.number().int().nonnegative().optional(),
  })
  .strict()
  .superRefine((run, context) => {
    if (run.status === "failed" && !run.failureReason) {
      context.addIssue({ code: "custom", path: ["failureReason"], message: "A failed run requires a failure reason." });
    }

    if (run.status !== "failed" && run.failureReason) {
      context.addIssue({ code: "custom", path: ["failureReason"], message: "Failure reason is only valid for failed runs." });
    }

    if (reviewableStatuses.has(run.status) && !run.normalizedProposedResult) {
      context.addIssue({
        code: "custom",
        path: ["normalizedProposedResult"],
        message: "A completed extraction lifecycle state requires a normalized proposal.",
      });
    }

    if (reviewableStatuses.has(run.status) && !run.completedAt) {
      context.addIssue({
        code: "custom",
        path: ["completedAt"],
        message: "A completed extraction lifecycle state requires a completion time.",
      });
    }

    if (["approved", "rejected"].includes(run.status) && (!run.reviewedBy || !run.reviewedAt)) {
      context.addIssue({
        code: "custom",
        path: ["reviewedAt"],
        message: "Approved and rejected runs require reviewer identity and review time.",
      });
    }

    if (run.status === "superseded" && !run.supersededByRunId) {
      context.addIssue({
        code: "custom",
        path: ["supersededByRunId"],
        message: "A superseded run must identify its replacement.",
      });
    }
  });
