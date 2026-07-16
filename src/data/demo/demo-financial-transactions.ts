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
  type TransactionLifecycle,
} from "@/domain";
import type { TransactionSourceType } from "@/types";

const zero = decimalStringSchema.parse("0");
const myr = currencyCodeSchema.parse("MYR");

function makeLine(id: string, description: string, amount: string) {
  const unitPrice = { amount: decimalStringSchema.parse(amount), currency: myr };
  const subtotal = calculateLineSubtotal(decimalStringSchema.parse("1"), unitPrice);
  const totalExcludingTax = calculateLineTotal({
    subtotal,
    taxAmount: { amount: zero, currency: unitPrice.currency },
  });
  const taxAmount = calculateLineTax(totalExcludingTax, zero);
  const totalIncludingTax = calculateLineTotal({ subtotal, taxAmount });

  return transactionLineSchema.parse({
    id: `${id}_line_1`,
    description,
    quantity: "1",
    unitCode: "C62",
    unitPrice,
    charges: [],
    taxTreatment: {
      taxTypeCode: "NOT_APPLICABLE",
      taxRate: "0",
      taxableAmount: totalExcludingTax,
      taxAmount,
    },
    subtotal,
    totalExcludingTax,
    totalIncludingTax,
  });
}

interface DemoTransactionInput {
  id: string;
  direction: "income" | "expense";
  lifecycle: TransactionLifecycle;
  date: string;
  amount: string;
  categoryCode: string;
  description: string;
  counterpartyNameSnapshot: string;
  paymentMethodCode: string;
  sourceType: TransactionSourceType;
  sourceDocumentId?: string;
  extractionRunId?: string;
  eInvoiceTreatment: EInvoiceTreatment;
  createdAt: string;
}

function makeFinancialTransaction(input: DemoTransactionInput) {
  const line = makeLine(input.id, input.description, input.amount);
  const totals = calculateTransactionTotals([line]);
  return financialTransactionSchema.parse({
    id: input.id,
    businessId: "business_demo",
    direction: input.direction,
    lifecycle: input.lifecycle,
    transactionDate: input.date,
    accountingDate: input.date,
    counterpartyNameSnapshot: input.counterpartyNameSnapshot,
    sourceLinks: input.sourceDocumentId
      ? [{
          sourceDocumentId: input.sourceDocumentId,
          extractionRunId: input.extractionRunId,
          relationship: "primary",
        }]
      : [],
    description: input.description,
    categoryCode: input.categoryCode,
    currency: "MYR",
    lines: [line],
    totals,
    paymentStatus: "paid",
    paymentMethodCode: input.paymentMethodCode,
    eInvoiceTreatment: input.eInvoiceTreatment,
    confidenceScore: input.lifecycle === "review_required" ? 0.82 : undefined,
    confirmation: input.lifecycle === "confirmed"
      ? { confirmedBy: "demo-lina", confirmedAt: input.createdAt }
      : undefined,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    createdBy: "demo-lina",
  });
}

const fixtureInputs: DemoTransactionInput[] = [
  {
    id: "txn_001",
    direction: "income",
    lifecycle: "confirmed",
    date: "2026-07-14",
    amount: "480",
    categoryCode: "Sales",
    description: "Morning nasi lemak sales",
    counterpartyNameSnapshot: "Walk-in customers",
    paymentMethodCode: "DuitNow QR",
    sourceType: "manual",
    eInvoiceTreatment: "consolidated_candidate",
    createdAt: "2026-07-14T04:45:00.000Z",
  },
  {
    id: "txn_002",
    direction: "expense",
    lifecycle: "review_required",
    date: "2026-07-13",
    amount: "86.40",
    categoryCode: "Inventory",
    description: "Cooking ingredients and packaging",
    counterpartyNameSnapshot: "Maju Mart",
    paymentMethodCode: "Bank Transfer",
    sourceType: "receipt",
    sourceDocumentId: "source_demo_receipt",
    extractionRunId: "extraction_demo_receipt",
    eInvoiceTreatment: "undetermined",
    createdAt: "2026-07-13T10:30:00.000Z",
  },
  {
    id: "txn_003",
    direction: "income",
    lifecycle: "confirmed",
    date: "2026-07-12",
    amount: "850",
    categoryCode: "Catering",
    description: "Catering deposit for 40 guests",
    counterpartyNameSnapshot: "Suria Events",
    paymentMethodCode: "Bank Transfer",
    sourceType: "whatsapp",
    sourceDocumentId: "source_demo_whatsapp",
    extractionRunId: "extraction_demo_whatsapp",
    eInvoiceTreatment: "individual",
    createdAt: "2026-07-12T06:20:00.000Z",
  },
  {
    id: "txn_004",
    direction: "expense",
    lifecycle: "review_required",
    date: "2026-07-11",
    amount: "126.40",
    categoryCode: "Supplies",
    description: "Weekly grocery purchase",
    counterpartyNameSnapshot: "Pasar Raya Kita",
    paymentMethodCode: "Cash",
    sourceType: "voice",
    sourceDocumentId: "source_demo_voice",
    extractionRunId: "extraction_demo_voice",
    eInvoiceTreatment: "self_billed_candidate",
    createdAt: "2026-07-11T09:10:00.000Z",
  },
  {
    id: "txn_005",
    direction: "expense",
    lifecycle: "confirmed",
    date: "2026-07-10",
    amount: "78",
    categoryCode: "Utilities",
    description: "Mobile and internet bill",
    counterpartyNameSnapshot: "CelcomDigi",
    paymentMethodCode: "Auto debit",
    sourceType: "csv",
    sourceDocumentId: "source_demo_csv",
    extractionRunId: "extraction_demo_csv",
    eInvoiceTreatment: "not_required",
    createdAt: "2026-07-10T02:05:00.000Z",
  },
  {
    id: "txn_006",
    direction: "income",
    lifecycle: "confirmed",
    date: "2026-07-09",
    amount: "620",
    categoryCode: "Sales",
    description: "Office lunch order",
    counterpartyNameSnapshot: "Teras Digital",
    paymentMethodCode: "Bank Transfer",
    sourceType: "bank_statement",
    sourceDocumentId: "source_demo_bank",
    extractionRunId: "extraction_demo_bank",
    eInvoiceTreatment: "undetermined",
    createdAt: "2026-07-09T05:15:00.000Z",
  },
];

export const DEMO_FINANCIAL_TRANSACTIONS = fixtureInputs.map(makeFinancialTransaction);

export const DEMO_TRANSACTION_SOURCE_TYPES = Object.fromEntries(
  fixtureInputs.map((fixture) => [fixture.id, fixture.sourceType]),
) as Record<string, TransactionSourceType>;
