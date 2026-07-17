import { z } from "zod";

export const loanReadinessStatusSchema = z.enum([
  "insufficient_data",
  "needs_review",
  "not_ready",
  "borderline",
  "ready",
  "strong",
]);

export const loanTermsSchema = z.object({
  principal: z.number().positive().finite().max(100_000_000),
  annualRatePercent: z.number().min(0).max(100).finite(),
  tenureMonths: z.number().int().min(1).max(360),
}).strict();

export const readinessTransactionSchema = z.object({
  id: z.string().uuid(),
  date: z.string().date(),
  direction: z.enum(["income", "expense"]),
  lifecycle: z.enum(["proposed", "review_required", "confirmed", "voided"]),
  categoryCode: z.string().min(1),
  amount: z.number().nonnegative().finite(),
  confidence: z.number().min(0).max(1).nullable(),
}).strict();

export const readinessDebtSchema = z.object({
  id: z.string(),
  monthlyRepayment: z.number().positive().finite(),
  confidence: z.number().min(0).max(1),
  sourceTransactionIds: z.array(z.string().uuid()).min(1),
}).strict();

export type LoanTerms = z.infer<typeof loanTermsSchema>;
export type ReadinessTransaction = z.infer<typeof readinessTransactionSchema>;
export type ReadinessDebt = z.infer<typeof readinessDebtSchema>;
