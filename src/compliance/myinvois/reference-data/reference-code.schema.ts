import { z } from "zod";
import { isoDateSchema, isoDateTimeSchema } from "@/domain";

export const myInvoisReferenceCodeSchema = z.object({
  codeSet: z.enum(["classification", "country", "currency", "invoice_type", "msic", "payment_mode", "state", "tax_type", "unit_of_measurement"]),
  code: z.string().trim().min(1).max(50),
  description: z.string().trim().min(1).max(500),
  active: z.boolean(),
  effectiveFrom: isoDateSchema.optional(),
  effectiveTo: isoDateSchema.optional(),
  sourceVersion: z.string().trim().min(1).max(200),
  syncedAt: isoDateTimeSchema,
}).strict();
