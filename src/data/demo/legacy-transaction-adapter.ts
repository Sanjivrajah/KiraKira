import { moneyToDisplayNumber } from "@/domain";
import type { FinancialTransaction } from "@/domain";
import type { Transaction, TransactionSourceType } from "@/types";

/** Presentation adapter for the existing local-storage/UI transaction shape. */
export function toLegacyTransaction(
  transaction: FinancialTransaction,
  sourceType: TransactionSourceType,
): Transaction {
  if (transaction.currency !== "MYR") {
    throw new RangeError("The current transaction UI only supports MYR.");
  }

  const status = {
    proposed: "draft",
    review_required: "needs_review",
    confirmed: "confirmed",
    voided: "failed",
  }[transaction.lifecycle] as Transaction["status"];

  return {
    id: transaction.id,
    businessId: transaction.businessId,
    createdBy: transaction.createdBy ?? transaction.confirmation?.confirmedBy ?? "system",
    type: transaction.direction,
    status,
    sourceType,
    sourceDocumentId: transaction.sourceLinks.find((link) => link.relationship === "primary")?.sourceDocumentId ?? null,
    date: transaction.transactionDate,
    counterpartyId: transaction.counterpartyId ?? null,
    counterpartyName: transaction.counterpartyNameSnapshot ?? "",
    description: transaction.description,
    category: transaction.categoryCode,
    currency: "MYR",
    subtotal: moneyToDisplayNumber(transaction.totals.taxExclusiveAmount),
    tax: moneyToDisplayNumber(transaction.totals.taxTotal),
    total: moneyToDisplayNumber(transaction.totals.payableAmount),
    paymentMethod: transaction.paymentMethodCode ?? null,
    confidenceScore: transaction.confidenceScore ?? null,
    notes: transaction.confirmation?.notes ?? null,
    items: transaction.lines.map((line) => ({
      id: line.id,
      description: line.description,
      quantity: Number(line.quantity),
      unitPrice: moneyToDisplayNumber(line.unitPrice),
      taxRate: Number(line.taxTreatment.taxRate),
      subtotal: moneyToDisplayNumber(line.subtotal),
      tax: moneyToDisplayNumber(line.taxTreatment.taxAmount),
      total: moneyToDisplayNumber(line.totalIncludingTax),
    })),
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
  };
}
