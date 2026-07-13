import { z } from "zod";

const invoiceItemSchema = z.object({
  id: z.string().min(1),
  description: z.string().trim().min(2, "Describe this item.").max(140, "Keep the description under 140 characters."),
  quantity: z.coerce.number<number>().positive("Quantity must be greater than 0.").max(100_000, "Enter a smaller quantity."),
  unitPrice: z.coerce.number<number>().min(0, "Unit price cannot be negative.").max(10_000_000, "Enter a smaller unit price."),
  taxRate: z.coerce.number<number>().min(0, "Tax cannot be negative.").max(100, "Tax cannot exceed 100%."),
});

export const invoiceFormSchema = z.object({
  invoiceNumber: z.string().trim().min(1, "Enter an invoice number.").max(40, "Keep the invoice number under 40 characters."),
  customerName: z.string().trim().min(2, "Enter the customer name.").max(100, "Keep the name under 100 characters."),
  customerEmail: z.string().trim().refine((value) => !value || z.email().safeParse(value).success, "Enter a valid email address."),
  buyerTin: z.string().trim().max(30, "Keep the buyer TIN under 30 characters."),
  issueDate: z.string().min(1, "Choose an issue date."),
  dueDate: z.string().min(1, "Choose a due date."),
  status: z.enum(["draft", "sent"]),
  items: z.array(invoiceItemSchema).min(1, "Add at least one line item."),
  notes: z.string().trim().max(500, "Keep notes under 500 characters."),
  paymentTerms: z.string().trim().max(240, "Keep payment terms under 240 characters."),
}).refine((values) => !values.issueDate || !values.dueDate || values.dueDate >= values.issueDate, {
  path: ["dueDate"], message: "Due date must be on or after the issue date.",
});

export type InvoiceFormValues = z.input<typeof invoiceFormSchema>;
export type ValidInvoiceFormValues = z.output<typeof invoiceFormSchema>;
