import { z } from "zod";

export const transactionTypeSchema = z.enum(["income", "expense", "customer_payment", "unknown"]);
export const paymentMethodSchema = z.enum(["cash", "bank_transfer", "card", "ewallet", "credit", "unknown"]);
export const missingFieldSchema = z.enum(["type", "amount", "description", "transactionDate", "paymentMethod", "merchantOrCustomer", "purpose"]);

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "transactionDate must be an ISO date.");

export const transactionExtractionSchema = z.object({
  type: transactionTypeSchema,
  amount: z.number().positive().nullable(),
  currency: z.literal("MYR"),
  description: z.string().trim(),
  merchantOrCustomer: z.string().trim().nullable(),
  paymentMethod: paymentMethodSchema,
  transactionDate: isoDateSchema.nullable(),
  category: z.string().trim().nullable(),
  quantity: z.number().positive().nullable(),
  unit: z.string().trim().nullable(),
  missingFields: z.array(missingFieldSchema),
  confidence: z.number().min(0).max(1),
});

export type TransactionExtraction = z.infer<typeof transactionExtractionSchema>;
