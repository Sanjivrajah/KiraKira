import {
  calculateLineSubtotal,
  calculateLineTax,
  calculateLineTotal,
  calculateTransactionTotals,
  currencyCodeSchema,
  decimalStringSchema,
  financialTransactionSchema,
  transactionLineSchema,
  type EInvoiceTreatment,
  type ExtractionRun,
  type FinancialTransaction,
  type TransactionSourceLink,
} from "@/domain";
import type { TransactionSourceType } from "@/types";

export interface TransactionReviewViewModel {
  type: "income" | "expense";
  date: string;
  amount: number | undefined;
  category: string;
  description: string;
  counterpartyName: string;
  paymentMethod: string;
  source: TransactionSourceType;
  eInvoiceTreatment: EInvoiceTreatment;
  fieldConfidence: Record<string, number>;
}

export function transactionReviewToDomain(input: TransactionReviewViewModel, metadata: {
  id: string;
  businessId: string;
  userId: string;
  now: string;
  sourceLinks?: TransactionSourceLink[];
  extractionRun?: ExtractionRun;
}): FinancialTransaction {
  if (!input.amount || input.amount <= 0) throw new Error("Transaction amount must be greater than zero.");
  const currency = currencyCodeSchema.parse("MYR");
  const zero = decimalStringSchema.parse("0");
  const unitPrice = { amount: decimalStringSchema.parse(String(input.amount)), currency };
  const subtotal = calculateLineSubtotal(decimalStringSchema.parse("1"), unitPrice);
  const totalExcludingTax = calculateLineTotal({ subtotal, taxAmount: { amount: zero, currency } });
  const taxAmount = calculateLineTax(totalExcludingTax, zero);
  const totalIncludingTax = calculateLineTotal({ subtotal, taxAmount });
  const line = transactionLineSchema.parse({
    id: `${metadata.id}_line_1`,
    description: input.description,
    quantity: "1",
    unitCode: "C62",
    unitPrice,
    charges: [],
    taxTreatment: { taxTypeCode: "06", taxRate: "0", taxableAmount: totalExcludingTax, taxAmount },
    subtotal,
    totalExcludingTax,
    totalIncludingTax,
  });
  const confidenceValues = metadata.extractionRun?.fields.map((field) => field.confidence)
    ?? Object.values(input.fieldConfidence);
  const confidenceScore = confidenceValues.length
    ? confidenceValues.reduce((sum, confidence) => sum + confidence, 0) / confidenceValues.length
    : undefined;
  return financialTransactionSchema.parse({
    id: metadata.id,
    businessId: metadata.businessId,
    direction: input.type,
    lifecycle: "confirmed",
    transactionDate: input.date,
    accountingDate: input.date,
    counterpartyNameSnapshot: input.counterpartyName || undefined,
    sourceLinks: metadata.sourceLinks ?? (metadata.extractionRun ? [{
      sourceDocumentId: metadata.extractionRun.sourceDocumentId,
      extractionRunId: metadata.extractionRun.id,
      relationship: "primary",
    }] : []),
    description: input.description,
    categoryCode: input.category,
    currency,
    lines: [line],
    totals: calculateTransactionTotals([line]),
    paymentStatus: "unknown",
    ...(input.paymentMethod ? { paymentMethodCode: input.paymentMethod } : {}),
    eInvoiceTreatment: input.eInvoiceTreatment,
    ...(confidenceScore !== undefined ? { confidenceScore } : {}),
    confirmation: { confirmedBy: metadata.userId, confirmedAt: metadata.now },
    createdAt: metadata.now,
    updatedAt: metadata.now,
    createdBy: metadata.userId,
  });
}
