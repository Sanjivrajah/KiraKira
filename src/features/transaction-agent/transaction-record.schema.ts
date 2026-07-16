import { z } from "zod";
import { transactionExtractionSchema } from "@/features/transaction-agent/transaction.schema";

const recordFields = transactionExtractionSchema.extend({
  id: z.string().uuid(),
  telegramUserId: z.string().min(1),
  telegramChatId: z.string().min(1),
  sourceType: z.enum(["telegram_text", "telegram_voice", "telegram_photo", "telegram_document", "telegram_forwarded"]),
  originalInput: z.string().min(1),
  transcript: z.string().min(1).optional(),
  telegramFileId: z.string().min(1).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const transactionDraftSchema = recordFields.extend({
  status: z.enum(["pending", "confirmed", "cancelled"]),
});

export const confirmedTransactionSchema = recordFields.omit({ missingFields: true }).extend({
  status: z.enum(["confirmed", "voided"]),
  confirmedAt: z.string().datetime(),
  voidedAt: z.string().datetime().optional(),
  voidReason: z.string().trim().min(1).max(280).optional(),
  /** Versioned in-place local migration. Missing values are Stage 1 records. */
  schemaVersion: z.literal(2).optional(),
  originalConfirmedSnapshot: transactionExtractionSchema.optional(),
  amendments: z.array(z.object({
    id: z.string().uuid(),
    changedFields: z.array(z.enum(["amount", "description", "merchantOrCustomer", "transactionDate", "paymentMethod", "type", "category"])).min(1),
    previousSnapshot: transactionExtractionSchema,
    nextSnapshot: transactionExtractionSchema,
    reason: z.string().trim().max(280).nullable(),
    createdAt: z.string().datetime(),
  })).optional(),
});

export type TransactionDraft = z.infer<typeof transactionDraftSchema>;
export type ConfirmedTransaction = z.infer<typeof confirmedTransactionSchema>;
