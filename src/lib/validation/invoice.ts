import { z } from "zod";

const optionalMoney = z.coerce.number<number>().min(0, "Amount cannot be negative.").max(10_000_000).default(0);
const invoiceItemSchema = z.object({
  id: z.string().min(1),
  description: z.string().trim().min(2, "Describe this item.").max(1000),
  quantity: z.coerce.number<number>().positive("Quantity must be greater than 0.").max(100_000),
  unitPrice: z.coerce.number<number>().min(0, "Unit price cannot be negative.").max(10_000_000),
  classificationCode: z.string().trim().min(1, "Choose a classification code.").default("022"),
  unitCode: z.string().trim().min(1, "Choose a unit code.").default("C62"),
  taxTypeCode: z.string().trim().min(1, "Choose a tax type.").default("06"),
  taxRate: z.coerce.number<number>().min(0, "Tax cannot be negative.").max(100, "Tax cannot exceed 100%."),
  exemptionReason: z.string().trim().max(500).default(""),
  discountAmount: optionalMoney,
  chargeAmount: optionalMoney,
}).superRefine((item, context) => {
  if (item.taxTypeCode === "E" && !item.exemptionReason) {
    context.addIssue({ code: "custom", path: ["exemptionReason"], message: "Explain why this item is tax exempt." });
  }
  if (item.discountAmount > item.quantity * item.unitPrice + item.chargeAmount) {
    context.addIssue({ code: "custom", path: ["discountAmount"], message: "Discount cannot exceed the line amount and charges." });
  }
});

export const invoiceFormSchema = z.object({
  documentType: z.enum(["invoice", "credit_note", "debit_note", "refund_note", "self_billed_invoice", "self_billed_credit_note", "self_billed_debit_note", "self_billed_refund_note"]).default("invoice"),
  invoiceNumber: z.string().trim().min(1, "Enter a document number.").max(100),
  buyerId: z.string().min(1, "Choose or create a buyer.").default("legacy_buyer"),
  customerName: z.string().trim().max(200).default(""),
  customerEmail: z.string().trim().refine((value) => !value || z.email().safeParse(value).success, "Enter a valid email address.").default(""),
  buyerTin: z.string().trim().max(50).default(""),
  issueDate: z.string().min(1, "Choose an issue date."),
  issueTime: z.string().min(1, "Choose an issue time.").default("09:00"),
  dueDate: z.string().min(1, "Choose a due date."),
  status: z.enum(["draft", "sent"]),
  originalDocumentReference: z.string().trim().max(200).default(""),
  paymentModeCode: z.string().min(1, "Choose a payment mode.").default("03"),
  bankAccountIdentifier: z.string().trim().max(200).default(""),
  prepaymentAmount: optionalMoney,
  items: z.array(invoiceItemSchema).min(1).max(50),
  notes: z.string().trim().max(1000).default(""),
  paymentTerms: z.string().trim().max(1000).default(""),
}).superRefine((values, context) => {
  if (values.dueDate < values.issueDate) context.addIssue({ code: "custom", path: ["dueDate"], message: "Due date must be on or after the issue date." });
  if (values.documentType !== "invoice" && values.documentType !== "self_billed_invoice" && !values.originalDocumentReference) {
    context.addIssue({ code: "custom", path: ["originalDocumentReference"], message: "Adjustment documents require the original document reference." });
  }
  const grossTotal = values.items.reduce((sum, item) => {
    const line = item.quantity * item.unitPrice - item.discountAmount + item.chargeAmount;
    return sum + line + line * item.taxRate / 100;
  }, 0);
  if (values.prepaymentAmount > grossTotal) {
    context.addIssue({ code: "custom", path: ["prepaymentAmount"], message: "Prepayment cannot exceed the invoice total." });
  }
});

export type InvoiceFormValues = z.input<typeof invoiceFormSchema>;
export type ValidInvoiceFormValues = z.output<typeof invoiceFormSchema>;
