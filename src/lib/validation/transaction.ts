import { z } from "zod";

export const transactionFormSchema = z.object({
  type: z.enum(["income", "expense"]),
  date: z.string().min(1, "Choose a transaction date."),
  amount: z.coerce.number<number>().positive("Enter an amount greater than RM0.").max(10_000_000, "Enter an amount below RM10,000,000."),
  category: z.string().trim().min(2, "Enter a category.").max(60, "Keep the category under 60 characters."),
  description: z.string().trim().min(3, "Describe the transaction.").max(160, "Keep the description under 160 characters."),
  counterpartyName: z.string().trim().max(100, "Keep the name under 100 characters."),
  paymentMethod: z.string().trim().max(60, "Keep the payment method under 60 characters."),
  source: z.enum(["receipt", "voice", "manual", "csv", "bank_statement", "whatsapp"]),
});

export type TransactionFormValues = z.input<typeof transactionFormSchema>;
export type ValidTransactionFormValues = z.output<typeof transactionFormSchema>;
