import { z } from "zod";
import { documentIdSchema, isoDateTimeSchema } from "@/domain";

const identifierSchema = z.string().trim().min(1).max(200);
const payloadSchema = z.union([z.json(), z.string()]);

export const myInvoisDocumentSnapshotSchema = z
  .object({
    id: identifierSchema,
    commercialDocumentId: documentIdSchema,
    documentTypeCode: z.string().trim().min(2).max(2),
    documentVersion: z.string().regex(/^\d+\.\d+$/),
    format: z.enum(["json", "xml"]),
    unsignedPayload: payloadSchema,
    signedPayload: payloadSchema.optional(),
    payloadHash: z.string().regex(/^[a-f0-9]{64}$/i, "Use a SHA-256 payload hash."),
    generatedAt: isoDateTimeSchema,
    mapperVersion: identifierSchema,
  })
  .strict()
  .superRefine((snapshot, context) => {
    if (snapshot.format === "xml" && typeof snapshot.unsignedPayload !== "string") {
      context.addIssue({ code: "custom", path: ["unsignedPayload"], message: "XML snapshots require a string payload." });
    }
    if (snapshot.format === "json" && typeof snapshot.unsignedPayload === "string") {
      context.addIssue({ code: "custom", path: ["unsignedPayload"], message: "JSON snapshots require a JSON value." });
    }
  });

function deepFreeze<Value>(value: Value): Value {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export function createImmutableMyInvoisSnapshot(input: unknown) {
  return deepFreeze(myInvoisDocumentSnapshotSchema.parse(input));
}

export const myInvoisSubmissionSchema = z
  .object({
    id: identifierSchema,
    environment: z.enum(["sandbox", "production"]),
    submissionUid: identifierSchema.optional(),
    status: z.enum(["pending", "submitted", "processing", "completed", "failed"]),
    requestedAt: isoDateTimeSchema,
    completedAt: isoDateTimeSchema.optional(),
    submittedDocumentIds: z.array(documentIdSchema).min(1).max(100),
    httpStatus: z.number().int().min(100).max(599).optional(),
    retryCount: z.number().int().nonnegative(),
    idempotencyKey: identifierSchema,
    errorCode: identifierSchema.optional(),
    errorMessage: z.string().trim().min(1).max(2000).optional(),
  })
  .strict();

export const myInvoisDocumentStateSchema = z
  .object({
    commercialDocumentId: documentIdSchema,
    myInvoisUuid: z.uuid().optional(),
    longId: identifierSchema.optional(),
    status: z.enum(["generated", "submitted", "processing", "valid", "invalid", "cancelled", "rejected", "submission_failed"]),
    validationResults: z.array(z.object({
      code: identifierSchema,
      severity: z.enum(["info", "warning", "error"]),
      fieldPath: z.string().trim().min(1).max(500).optional(),
      message: z.string().trim().min(1).max(2000),
      source: z.enum(["local", "myinvois"]),
      validatedAt: isoDateTimeSchema,
    }).strict()),
    submittedAt: isoDateTimeSchema.optional(),
    validatedAt: isoDateTimeSchema.optional(),
    cancellationDeadline: isoDateTimeSchema.optional(),
    qrCodeUrl: z.url().optional(),
    shareUrl: z.url().optional(),
  })
  .strict();

export const myInvoisStatusEventSchema = z.object({
  id: identifierSchema,
  commercialDocumentId: documentIdSchema,
  status: z.enum(["generated", "submitted", "processing", "valid", "invalid", "cancelled", "rejected", "submission_failed"]),
  occurredAt: isoDateTimeSchema,
  source: z.enum(["niagaai", "myinvois"]),
  details: z.string().trim().min(1).max(2000).optional(),
}).strict();
