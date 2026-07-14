import { z } from "zod";

export const bankStatementExtractionSchema = z.object({
  transactions: z.array(z.object({
    date: z.string(),
    type: z.enum(["income", "expense"]),
    amount: z.number(),
    currency: z.string(),
    description: z.string(),
    counterpartyName: z.string(),
    paymentMethod: z.string(),
    evidence: z.string(),
  })).max(100),
  warnings: z.array(z.string()).max(20),
});

export type BankStatementExtraction = z.infer<typeof bankStatementExtractionSchema>;
