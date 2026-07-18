import { z } from "zod";
import {
  calculateDocumentLineTotals,
  calculateDocumentMonetaryTotals,
  commercialDocumentSchema,
  currencyCodeSchema,
  decimalStringSchema,
  documentLineSchema,
  groupDocumentTaxes,
  type CommercialDocument,
} from "@/domain";

const decimalInput = z.string().trim().regex(/^\d+(?:\.\d+)?$/, "Enter a valid number.");

export const invoiceLineViewModelSchema = z.object({
  id: z.string().min(1),
  description: z.string().trim().min(2, "Describe this item.").max(1000),
  quantity: decimalInput.refine((value) => Number(value) > 0, "Quantity must be greater than zero."),
  unitPrice: decimalInput,
  classificationCode: z.string().trim().min(1, "Choose a classification code."),
  unitCode: z.string().trim().min(1, "Choose a unit code."),
  taxTypeCode: z.string().trim().min(1, "Choose a tax type."),
  taxRate: decimalInput.refine((value) => Number(value) <= 100, "Tax cannot exceed 100%."),
  exemptionReason: z.string().trim().max(500),
  discountAmount: decimalInput,
  chargeAmount: decimalInput,
});

export const invoiceBuilderViewModelSchema = z.object({
  documentType: z.enum(["invoice", "credit_note", "debit_note", "refund_note", "self_billed_invoice", "self_billed_credit_note", "self_billed_debit_note", "self_billed_refund_note"]),
  invoiceNumber: z.string().trim().min(1).max(100),
  issueDate: z.string().min(1),
  issueTime: z.string().regex(/^\d{2}:\d{2}(?::\d{2})?$/),
  dueDate: z.string().min(1),
  buyerId: z.string().min(1, "Choose or create a buyer."),
  originalDocumentReference: z.string().trim().max(200),
  paymentModeCode: z.string().trim().min(1),
  bankAccountIdentifier: z.string().trim().max(200),
  prepaymentAmount: decimalInput.default("0"),
  paymentTerms: z.string().trim().max(1000),
  notes: z.string().trim().max(1000),
  lines: z.array(invoiceLineViewModelSchema).min(1).max(50),
});

export type InvoiceBuilderViewModel = z.input<typeof invoiceBuilderViewModelSchema>;

export function invoiceBuilderToDomain(input: InvoiceBuilderViewModel, metadata: {
  id: string;
  businessId: string;
  supplierPartyId: string;
  now: string;
}): CommercialDocument {
  const values = invoiceBuilderViewModelSchema.parse(input);
  const currency = currencyCodeSchema.parse("MYR");
  const lines = values.lines.map((item) => {
    const quantity = decimalStringSchema.parse(item.quantity);
    const unitPrice = { amount: decimalStringSchema.parse(item.unitPrice), currency };
    const taxRate = decimalStringSchema.parse(item.taxRate);
    const allowances = Number(item.discountAmount) > 0 ? [{
      type: "allowance" as const,
      reason: "Line discount",
      amount: { amount: decimalStringSchema.parse(item.discountAmount), currency },
    }] : [];
    const charges = Number(item.chargeAmount) > 0 ? [{
      type: "charge" as const,
      reason: "Line charge",
      amount: { amount: decimalStringSchema.parse(item.chargeAmount), currency },
    }] : [];
    const totals = calculateDocumentLineTotals({ quantity, unitPrice, allowances, charges, taxRate });
    return documentLineSchema.parse({
      id: item.id,
      description: item.description,
      quantity,
      unitCode: item.unitCode,
      unitPrice,
      classificationCode: item.classificationCode,
      taxTreatment: {
        taxTypeCode: item.taxTypeCode,
        taxRate,
        taxableAmount: totals.taxExclusiveAmount,
        taxAmount: totals.taxAmount,
        ...(item.taxTypeCode === "E" ? { exemption: { code: "E", reason: item.exemptionReason || "Tax exempt" } } : {}),
      },
      allowances,
      charges,
      totals,
      itemMetadata: {},
    });
  });
  const taxTotals = groupDocumentTaxes(lines);
  const monetaryTotals = calculateDocumentMonetaryTotals({
    lines,
    taxTotals,
    prepaidAmount: { amount: decimalStringSchema.parse(values.prepaymentAmount), currency },
  });
  const adjustment = values.documentType.includes("credit_note") || values.documentType.includes("debit_note") || values.documentType.includes("refund_note");
  return commercialDocumentSchema.parse({
    id: metadata.id,
    businessId: metadata.businessId,
    documentType: values.documentType,
    internalDocumentNumber: values.invoiceNumber,
    issueDate: values.issueDate,
    issueTime: values.issueTime.length === 5 ? `${values.issueTime}:00` : values.issueTime,
    supplierPartyId: metadata.supplierPartyId,
    buyerPartyId: values.buyerId,
    sourceTransactionIds: [],
    currency,
    lines,
    allowances: [],
    charges: [],
    taxTotals,
    monetaryTotals,
    paymentInstructions: {
      paymentModeCode: values.paymentModeCode,
      dueDate: values.dueDate,
      ...(values.bankAccountIdentifier ? { bankAccountIdentifier: values.bankAccountIdentifier } : {}),
      ...(values.paymentTerms ? { paymentTerms: values.paymentTerms } : {}),
      paymentReference: values.invoiceNumber,
    },
    references: adjustment && values.originalDocumentReference
      ? [{ type: "original_invoice", externalReference: values.originalDocumentReference }]
      : [],
    notes: values.notes ? [values.notes] : [],
    status: "draft",
    createdAt: metadata.now,
    updatedAt: metadata.now,
  });
}
