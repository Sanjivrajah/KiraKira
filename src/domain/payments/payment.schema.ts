import { z } from "zod";
import {
  businessIdSchema,
  compareDecimalValues,
  decimalStringSchema,
  documentIdSchema,
  isoDateTimeSchema,
  moneyValueSchema,
  paymentAllocationIdSchema,
  paymentIdSchema,
  userIdSchema,
} from "../common";

const zero = decimalStringSchema.parse("0");
const positiveMoneySchema = moneyValueSchema.refine(
  (value) => compareDecimalValues(value.amount, zero) > 0,
  "Payment amount must be greater than zero.",
);

export const paymentSchema = z
  .object({
    id: paymentIdSchema,
    businessId: businessIdSchema,
    paymentDate: isoDateTimeSchema,
    amount: positiveMoneySchema,
    paymentModeCode: z.string().trim().min(1).max(50),
    bankReference: z.string().trim().min(1).max(200).optional(),
    externalReference: z.string().trim().min(1).max(200).optional(),
    status: z.enum(["pending", "completed", "failed", "cancelled", "refunded"]),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
    createdBy: userIdSchema.optional(),
    updatedBy: userIdSchema.optional(),
    version: z.number().int().nonnegative().optional(),
  })
  .strict();

export const paymentAllocationSchema = z
  .object({
    id: paymentAllocationIdSchema,
    paymentId: paymentIdSchema,
    documentId: documentIdSchema,
    allocatedAmount: positiveMoneySchema,
    allocatedAt: isoDateTimeSchema,
    notes: z.string().trim().min(1).max(1000).optional(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
    createdBy: userIdSchema.optional(),
    updatedBy: userIdSchema.optional(),
    version: z.number().int().nonnegative().optional(),
  })
  .strict();
