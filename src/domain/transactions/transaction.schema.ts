import { z } from "zod";
import {
  businessIdSchema,
  currencyCodeSchema,
  decimalStringSchema,
  entityIdSchema,
  extractionRunIdSchema,
  isoDateSchema,
  isoDateTimeSchema,
  moneyValueSchema,
  partyIdSchema,
  sourceDocumentIdSchema,
  transactionIdSchema,
  userIdSchema,
} from "../common";
import {
  calculateLineSubtotal,
  calculateLineTax,
  calculateLineTotal,
  compareDecimalStrings,
  reconcileTransactionTotals,
} from "./transaction-calculations";

const zero = decimalStringSchema.parse("0");
const oneHundred = decimalStringSchema.parse("100");
const nonNegativeDecimalSchema = decimalStringSchema.refine(
  (value) => compareDecimalStrings(value, zero) >= 0,
  "Value cannot be negative.",
);
const positiveDecimalSchema = decimalStringSchema.refine(
  (value) => compareDecimalStrings(value, zero) > 0,
  "Value must be greater than zero.",
);
const taxRateSchema = nonNegativeDecimalSchema.refine(
  (value) => compareDecimalStrings(value, oneHundred) <= 0,
  "Tax rate cannot exceed 100 percent.",
);

const nonNegativeMoneySchema = moneyValueSchema.refine(
  (value) => compareDecimalStrings(value.amount, zero) >= 0,
  "Money amount cannot be negative.",
);

export const lineDiscountSchema = z
  .object({
    amount: nonNegativeMoneySchema,
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const lineChargeSchema = z
  .object({
    amount: nonNegativeMoneySchema,
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export const transactionTaxTreatmentSchema = z
  .object({
    taxTypeCode: z.string().trim().min(1).max(50),
    taxRate: taxRateSchema,
    taxableAmount: nonNegativeMoneySchema,
    taxAmount: nonNegativeMoneySchema,
    exemption: z
      .object({
        code: z.string().trim().min(1).max(50).optional(),
        reason: z.string().trim().min(1).max(500),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((tax, context) => {
    if (tax.exemption && compareDecimalStrings(tax.taxRate, zero) !== 0) {
      context.addIssue({
        code: "custom",
        path: ["taxRate"],
        message: "An exempt tax treatment must use a zero tax rate.",
      });
    }
    if (tax.exemption && compareDecimalStrings(tax.taxAmount.amount, zero) !== 0) {
      context.addIssue({
        code: "custom",
        path: ["taxAmount"],
        message: "An exempt tax treatment must use a zero tax amount.",
      });
    }
  });

export const transactionLineSchema = z
  .object({
    id: entityIdSchema,
    itemReference: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().min(1).max(1000),
    quantity: positiveDecimalSchema,
    unitCode: z.string().trim().min(1).max(50),
    unitPrice: nonNegativeMoneySchema,
    classificationCode: z.string().trim().min(1).max(100).optional(),
    discount: lineDiscountSchema.optional(),
    charges: z.array(lineChargeSchema).max(100).default([]),
    taxTreatment: transactionTaxTreatmentSchema,
    subtotal: nonNegativeMoneySchema,
    totalExcludingTax: nonNegativeMoneySchema,
    totalIncludingTax: nonNegativeMoneySchema,
    countryOfOrigin: z.string().regex(/^[A-Z]{2}$/, "Use a two-letter uppercase country code.").optional(),
    tariffCode: z.string().trim().min(1).max(100).optional(),
  })
  .strict()
  .superRefine((line, context) => {
    const moneyValues = [
      line.unitPrice,
      line.subtotal,
      line.totalExcludingTax,
      line.totalIncludingTax,
      line.taxTreatment.taxableAmount,
      line.taxTreatment.taxAmount,
      ...(line.discount ? [line.discount.amount] : []),
      ...line.charges.map((charge) => charge.amount),
    ];
    if (moneyValues.some((value) => value.currency !== line.unitPrice.currency)) {
      context.addIssue({ code: "custom", message: "All line money values must use one currency." });
      return;
    }

    try {
      const expectedSubtotal = calculateLineSubtotal(line.quantity, line.unitPrice);
      const expectedExclusive = calculateLineTotal({
        subtotal: expectedSubtotal,
        discount: line.discount?.amount,
        charges: line.charges.map((charge) => charge.amount),
        taxAmount: { amount: zero, currency: line.unitPrice.currency },
      });
      const expectedTax = calculateLineTax(expectedExclusive, line.taxTreatment.taxRate);
      const expectedInclusive = calculateLineTotal({
        subtotal: expectedSubtotal,
        discount: line.discount?.amount,
        charges: line.charges.map((charge) => charge.amount),
        taxAmount: expectedTax,
      });

      const comparisons = [
        ["subtotal", line.subtotal.amount, expectedSubtotal.amount],
        ["totalExcludingTax", line.totalExcludingTax.amount, expectedExclusive.amount],
        ["taxTreatment.taxableAmount", line.taxTreatment.taxableAmount.amount, expectedExclusive.amount],
        ["taxTreatment.taxAmount", line.taxTreatment.taxAmount.amount, expectedTax.amount],
        ["totalIncludingTax", line.totalIncludingTax.amount, expectedInclusive.amount],
      ] as const;
      for (const [path, actual, expected] of comparisons) {
        if (compareDecimalStrings(actual, expected) !== 0) {
          context.addIssue({
            code: "custom",
            path: path.split("."),
            message: `Expected calculated amount ${expected}.`,
          });
        }
      }
    } catch (error) {
      context.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "Line amounts could not be calculated.",
      });
    }
  });

export const transactionTotalsSchema = z
  .object({
    lineExtensionAmount: nonNegativeMoneySchema,
    allowanceTotal: nonNegativeMoneySchema,
    chargeTotal: nonNegativeMoneySchema,
    taxExclusiveAmount: nonNegativeMoneySchema,
    taxTotal: nonNegativeMoneySchema,
    taxInclusiveAmount: nonNegativeMoneySchema,
    roundingAmount: moneyValueSchema,
    payableAmount: nonNegativeMoneySchema,
  })
  .strict();

export const transactionSourceLinkSchema = z
  .object({
    sourceDocumentId: sourceDocumentIdSchema,
    extractionRunId: extractionRunIdSchema.optional(),
    relationship: z.enum(["primary", "supporting", "derived"]),
    evidenceNotes: z.string().trim().min(1).max(1000).optional(),
  })
  .strict();

export const financialTransactionSchema = z
  .object({
    id: transactionIdSchema,
    businessId: businessIdSchema,
    direction: z.enum(["income", "expense"]),
    lifecycle: z.enum(["proposed", "review_required", "confirmed", "voided"]),
    transactionDate: isoDateSchema,
    accountingDate: isoDateSchema,
    counterpartyId: partyIdSchema.optional(),
    counterpartyNameSnapshot: z.string().trim().min(1).max(200).optional(),
    sourceLinks: z.array(transactionSourceLinkSchema).max(100).default([]),
    description: z.string().trim().min(1).max(1000),
    categoryCode: z.string().trim().min(1).max(100),
    currency: currencyCodeSchema,
    exchangeRateToMYR: positiveDecimalSchema.optional(),
    lines: z.array(transactionLineSchema).min(1).max(1000),
    totals: transactionTotalsSchema,
    paymentStatus: z.enum(["unpaid", "partially_paid", "paid", "not_applicable", "unknown"]),
    paymentMethodCode: z.string().trim().min(1).max(100).optional(),
    eInvoiceTreatment: z.enum([
      "individual",
      "consolidated_candidate",
      "self_billed_candidate",
      "not_required",
      "undetermined",
    ]),
    confidenceScore: z.number().min(0).max(1).optional(),
    confirmation: z
      .object({
        confirmedBy: userIdSchema,
        confirmedAt: isoDateTimeSchema,
        notes: z.string().trim().min(1).max(2000).optional(),
      })
      .strict()
      .optional(),
    voidMetadata: z
      .object({
        voidedBy: userIdSchema,
        voidedAt: isoDateTimeSchema,
        reason: z.string().trim().min(1).max(1000),
      })
      .strict()
      .optional(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
    createdBy: userIdSchema.optional(),
    updatedBy: userIdSchema.optional(),
    version: z.number().int().nonnegative().optional(),
  })
  .strict()
  .superRefine((transaction, context) => {
    if (transaction.currency !== "MYR" && !transaction.exchangeRateToMYR) {
      context.addIssue({
        code: "custom",
        path: ["exchangeRateToMYR"],
        message: "Foreign-currency transactions require an exchange rate to MYR.",
      });
    }
    if (
      transaction.currency === "MYR" &&
      transaction.exchangeRateToMYR &&
      compareDecimalStrings(transaction.exchangeRateToMYR, decimalStringSchema.parse("1")) !== 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["exchangeRateToMYR"],
        message: "MYR transactions can only use an exchange rate of 1.",
      });
    }
    if (transaction.lifecycle === "confirmed" && !transaction.confirmation) {
      context.addIssue({
        code: "custom",
        path: ["confirmation"],
        message: "Confirmed transactions require confirmation metadata.",
      });
    }
    if (transaction.lifecycle === "voided" && !transaction.voidMetadata) {
      context.addIssue({
        code: "custom",
        path: ["voidMetadata"],
        message: "Voided transactions require void metadata.",
      });
    }

    const sourceKeys = transaction.sourceLinks.map(
      (link) => `${link.sourceDocumentId}:${link.extractionRunId ?? ""}`,
    );
    if (new Set(sourceKeys).size !== sourceKeys.length) {
      context.addIssue({ code: "custom", path: ["sourceLinks"], message: "Source links must be unique." });
    }

    const lineCurrenciesMatch = transaction.lines.every((line) => line.unitPrice.currency === transaction.currency);
    const totalCurrenciesMatch = Object.values(transaction.totals).every(
      (money) => money.currency === transaction.currency,
    );
    if (!lineCurrenciesMatch || !totalCurrenciesMatch) {
      context.addIssue({ code: "custom", message: "Lines and totals must use the transaction currency." });
    }

    if (lineCurrenciesMatch && totalCurrenciesMatch) {
      const reconciliation = reconcileTransactionTotals(transaction.lines, transaction.totals);
      for (const difference of reconciliation.differences) {
        context.addIssue({
          code: "custom",
          path: ["totals", difference.field],
          message: `Expected reconciled amount ${difference.expected.amount}.`,
        });
      }
    }
  });
