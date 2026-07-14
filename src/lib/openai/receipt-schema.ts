import { z } from "zod";

const confidenceSchema = z.number().min(0).max(1);

export const extractedStringSchema = z.object({
  value: z.string().max(200).nullable(),
  evidenceText: z.string().max(280).nullable(),
  confidence: confidenceSchema,
});

export const extractedNumberSchema = z.object({
  value: z.number().nonnegative().nullable(),
  evidenceText: z.string().nullable(),
  confidence: confidenceSchema,
});

export const receiptExtractionSchema = z.object({
  documentType: z.enum(["receipt", "supplier_invoice", "unknown"]),
  merchantName: extractedStringSchema,
  invoiceNumber: extractedStringSchema,
  documentDate: extractedStringSchema,
  currency: extractedStringSchema,
  lineItems: z
    .array(z.object({
      description: z.string().max(140),
      quantity: z.number().positive().nullable(),
      unitPrice: z.number().nonnegative().nullable(),
      amount: z.number().nonnegative().nullable(),
      evidenceText: z.string().max(280).nullable(),
      confidence: confidenceSchema,
    }))
    .max(100),
  subtotal: extractedNumberSchema,
  tax: extractedNumberSchema,
  total: extractedNumberSchema,
  paymentMethod: extractedStringSchema,
  category: extractedStringSchema,
  missingFields: z.array(z.string().max(60)).max(50),
  warnings: z.array(z.string().max(200)).max(50),
  overallConfidence: confidenceSchema,
});

export type ReceiptExtraction = z.infer<typeof receiptExtractionSchema>;

export function validateReceiptArithmetic(extraction: ReceiptExtraction): string[] {
  const warnings = [...extraction.warnings];
  const tolerance = 0.02;
  const itemAmounts = extraction.lineItems
    .map((item) => item.amount)
    .filter((amount): amount is number => amount !== null);

  if (itemAmounts.length === extraction.lineItems.length && extraction.subtotal.value !== null) {
    const itemTotal = itemAmounts.reduce((sum, amount) => sum + amount, 0);
    if (Math.abs(itemTotal - extraction.subtotal.value) > tolerance) {
      warnings.push("The extracted line items do not add up to the subtotal.");
    }
  }

  if (extraction.subtotal.value !== null && extraction.tax.value !== null && extraction.total.value !== null) {
    const calculatedTotal = extraction.subtotal.value + extraction.tax.value;
    if (Math.abs(calculatedTotal - extraction.total.value) > tolerance) {
      warnings.push("The extracted subtotal and tax do not add up to the total.");
    }
  }

  return [...new Set(warnings)];
}
