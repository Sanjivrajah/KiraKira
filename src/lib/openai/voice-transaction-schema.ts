import { z } from "zod";

export const voiceTransactionExtractionSchema = z.object({
  relevant: z.boolean(),
  type: z.enum(["income", "expense", "unknown"]),
  date: z.string(),
  amount: z.number().nullable(),
  currency: z.enum(["MYR", "other", "unknown"]),
  category: z.string(),
  description: z.string(),
  counterpartyName: z.string(),
  paymentMethod: z.string(),
  evidence: z.string(),
  warnings: z.array(z.string()).max(10),
});

export type VoiceTransactionExtraction = z.infer<typeof voiceTransactionExtractionSchema>;
