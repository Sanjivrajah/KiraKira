import { z } from "zod";
import { transactionExtractionSchema } from "@/features/transaction-agent/transaction.schema";

const recordFields = transactionExtractionSchema.extend({
  id: z.string().uuid(),
  telegramUserId: z.string().min(1),
  telegramChatId: z.string().min(1),
  sourceType: z.literal("telegram_text"),
  originalInput: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const transactionDraftSchema = recordFields.extend({
  status: z.enum(["pending", "confirmed", "cancelled"]),
});

export const confirmedTransactionSchema = recordFields.omit({ missingFields: true }).extend({
  status: z.literal("confirmed"),
  confirmedAt: z.string().datetime(),
});

export type TransactionDraft = z.infer<typeof transactionDraftSchema>;
export type ConfirmedTransaction = z.infer<typeof confirmedTransactionSchema>;
