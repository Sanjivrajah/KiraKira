import type { Transaction, TransactionLineItem, TransactionStatus } from "@/types";
import type { FinancialTransaction } from "@/repositories/supabase/transaction-repository";

// TODO: Deprecate once UI components are refactored to consume `FinancialTransaction` directly.
export function toLegacyTransactionView(domain: FinancialTransaction): Transaction {
  return {
    id: domain.id,
    businessId: domain.businessId,
    createdBy: domain.createdBy || "unknown",
    type: domain.direction,
    status: mapLifecycleToStatus(domain.lifecycle),
    sourceType: "manual", // Defaulting to manual for UI mapping
    sourceDocumentId: domain.sourceLinks?.[0]?.sourceDocumentId || null,
    date: domain.transactionDate,
    counterpartyId: domain.counterpartyId,
    counterpartyName: domain.counterpartyNameSnapshot || "",
    description: domain.description,
    category: domain.categoryCode,
    currency: domain.currency as "MYR",
    subtotal: parseFloat(domain.totals.taxExclusiveAmount.amount),
    tax: parseFloat(domain.totals.taxTotal.amount),
    total: parseFloat(domain.totals.payableAmount.amount),
    paymentMethod: domain.paymentMethodCode,
    confidenceScore: domain.confidenceScore,
    notes: domain.confirmation?.notes,
    items: domain.lines.map(line => ({
      id: line.id,
      description: line.description,
      quantity: parseFloat(line.quantity),
      unitPrice: parseFloat(line.unitPrice.amount),
      taxRate: parseFloat(line.taxTreatment.taxRate),
      subtotal: parseFloat(line.totalExcludingTax.amount),
      tax: parseFloat(line.taxTreatment.taxAmount.amount),
      total: parseFloat(line.totalIncludingTax.amount)
    })),
    createdAt: domain.createdAt,
    updatedAt: domain.updatedAt,
  };
}

// TODO: Deprecate once UI components produce `FinancialTransaction` directly.
export function toDomainTransaction(legacy: Transaction): FinancialTransaction {
  return {
    id: legacy.id,
    businessId: legacy.businessId,
    direction: legacy.type,
    lifecycle: mapStatusToLifecycle(legacy.status),
    transactionDate: legacy.date,
    accountingDate: legacy.date, // Defaulting to same day
    counterpartyId: legacy.counterpartyId || undefined,
    counterpartyNameSnapshot: legacy.counterpartyName || undefined,
    sourceLinks: legacy.sourceDocumentId ? [{
      sourceDocumentId: legacy.sourceDocumentId,
      relationship: "primary"
    }] : [],
    description: legacy.description || "Transaction",
    categoryCode: legacy.category || "general",
    currency: legacy.currency,
    exchangeRateToMYR: "1",
    lines: legacy.items.length > 0 
      ? legacy.items.map(item => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity.toString(),
          unitCode: "unit",
          unitPrice: { amount: item.unitPrice.toString(), currency: legacy.currency },
          taxTreatment: {
            taxTypeCode: "sales_tax",
            taxRate: item.taxRate.toString(),
            taxableAmount: { amount: item.subtotal.toString(), currency: legacy.currency },
            taxAmount: { amount: item.tax.toString(), currency: legacy.currency },
          },
          subtotal: { amount: item.subtotal.toString(), currency: legacy.currency },
          totalExcludingTax: { amount: item.subtotal.toString(), currency: legacy.currency },
          totalIncludingTax: { amount: item.total.toString(), currency: legacy.currency },
        }))
      : [{
          id: `${legacy.id}_line_1`,
          description: legacy.description || "General item",
          quantity: "1",
          unitCode: "unit",
          unitPrice: { amount: legacy.subtotal.toString(), currency: legacy.currency },
          taxTreatment: {
            taxTypeCode: "sales_tax",
            taxRate: "0",
            taxableAmount: { amount: legacy.subtotal.toString(), currency: legacy.currency },
            taxAmount: { amount: legacy.tax.toString(), currency: legacy.currency },
          },
          subtotal: { amount: legacy.subtotal.toString(), currency: legacy.currency },
          totalExcludingTax: { amount: legacy.subtotal.toString(), currency: legacy.currency },
          totalIncludingTax: { amount: legacy.total.toString(), currency: legacy.currency },
        }],
    totals: {
      lineExtensionAmount: { amount: legacy.subtotal.toString(), currency: legacy.currency },
      allowanceTotal: { amount: "0", currency: legacy.currency },
      chargeTotal: { amount: "0", currency: legacy.currency },
      taxExclusiveAmount: { amount: legacy.subtotal.toString(), currency: legacy.currency },
      taxTotal: { amount: legacy.tax.toString(), currency: legacy.currency },
      taxInclusiveAmount: { amount: legacy.total.toString(), currency: legacy.currency },
      roundingAmount: { amount: "0", currency: legacy.currency },
      payableAmount: { amount: legacy.total.toString(), currency: legacy.currency },
    },
    paymentStatus: "paid", // default
    paymentMethodCode: legacy.paymentMethod || undefined,
    eInvoiceTreatment: "undetermined", // default
    confidenceScore: legacy.confidenceScore || undefined,
    confirmation: legacy.status === "confirmed" ? {
      confirmedBy: legacy.createdBy || "system",
      confirmedAt: legacy.updatedAt || legacy.createdAt || new Date().toISOString(),
      notes: legacy.notes || undefined,
    } : undefined,
    voidMetadata: legacy.status === "failed" ? {
      voidedBy: legacy.createdBy || "system",
      voidedAt: legacy.updatedAt || legacy.createdAt || new Date().toISOString(),
      reason: legacy.notes || "Transaction failed",
    } : undefined,
    createdAt: legacy.createdAt,
    updatedAt: legacy.updatedAt,
    createdBy: legacy.createdBy,
  } as FinancialTransaction;
}

function mapLifecycleToStatus(lifecycle: FinancialTransaction["lifecycle"]): TransactionStatus {
  switch (lifecycle) {
    case "proposed": return "draft";
    case "review_required": return "needs_review";
    case "confirmed": return "confirmed";
    case "voided": return "failed";
    default: return "draft";
  }
}

function mapStatusToLifecycle(status: TransactionStatus): FinancialTransaction["lifecycle"] {
  switch (status) {
    case "draft": return "proposed";
    case "needs_review": return "review_required";
    case "confirmed": return "confirmed";
    case "failed": return "voided";
    default: return "proposed";
  }
}
