import { z } from "zod";
import {
  addDecimalValues,
  businessIdSchema,
  compareDecimalValues,
  currencyCodeSchema,
  decimalStringSchema,
  documentIdSchema,
  entityIdSchema,
  isoDateSchema,
  isoDateTimeSchema,
  localTimeSchema,
  moneyValueSchema,
  partyIdSchema,
  transactionIdSchema,
  userIdSchema,
} from "../common";
import {
  calculateAllowanceChargeAmount,
  calculateDocumentLineTotals,
  groupDocumentTaxes,
  reconcileCommercialDocumentTotals,
} from "./document-calculations";

const zero = decimalStringSchema.parse("0");
const nonNegativeDecimalSchema = decimalStringSchema.refine(
  (value) => compareDecimalValues(value, zero) >= 0,
  "Value cannot be negative.",
);
const positiveDecimalSchema = decimalStringSchema.refine(
  (value) => compareDecimalValues(value, zero) > 0,
  "Value must be greater than zero.",
);
const nonNegativeMoneySchema = moneyValueSchema.refine(
  (value) => compareDecimalValues(value.amount, zero) >= 0,
  "Money amount cannot be negative.",
);

export const allowanceChargeSchema = z
  .object({
    type: z.enum(["allowance", "charge"]),
    reason: z.string().trim().min(1).max(500),
    reasonCode: z.string().trim().min(1).max(100).optional(),
    percentage: nonNegativeDecimalSchema.optional(),
    baseAmount: nonNegativeMoneySchema.optional(),
    amount: nonNegativeMoneySchema,
  })
  .strict()
  .superRefine((adjustment, context) => {
    if (Boolean(adjustment.percentage) !== Boolean(adjustment.baseAmount)) {
      context.addIssue({
        code: "custom",
        message: "Percentage-based adjustments require both percentage and base amount.",
      });
    }
    if (adjustment.baseAmount && adjustment.baseAmount.currency !== adjustment.amount.currency) {
      context.addIssue({ code: "custom", message: "Adjustment base and amount must use one currency." });
    }
    if (adjustment.percentage && adjustment.baseAmount) {
      const expected = calculateAllowanceChargeAmount(adjustment);
      if (compareDecimalValues(expected.amount, adjustment.amount.amount) !== 0) {
        context.addIssue({
          code: "custom",
          path: ["amount"],
          message: `Expected percentage-based amount ${expected.amount}.`,
        });
      }
    }
  });

export const documentTaxSubtotalSchema = z
  .object({
    taxTypeCode: z.string().trim().min(1).max(50),
    taxRate: nonNegativeDecimalSchema,
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
    if (tax.taxableAmount.currency !== tax.taxAmount.currency) {
      context.addIssue({ code: "custom", message: "Taxable and tax amounts must use one currency." });
    }
    if (tax.exemption && compareDecimalValues(tax.taxRate, zero) !== 0) {
      context.addIssue({ code: "custom", path: ["taxRate"], message: "Exempt tax must use a zero rate." });
    }
    if (tax.exemption && compareDecimalValues(tax.taxAmount.amount, zero) !== 0) {
      context.addIssue({ code: "custom", path: ["taxAmount"], message: "Exempt tax must use a zero amount." });
    }
  });

const documentLineTotalsSchema = z
  .object({
    lineExtensionAmount: nonNegativeMoneySchema,
    allowanceTotal: nonNegativeMoneySchema,
    chargeTotal: nonNegativeMoneySchema,
    taxExclusiveAmount: nonNegativeMoneySchema,
    taxAmount: nonNegativeMoneySchema,
    taxInclusiveAmount: nonNegativeMoneySchema,
  })
  .strict();

export const documentLineSchema = z
  .object({
    id: entityIdSchema,
    description: z.string().trim().min(1).max(1000),
    quantity: positiveDecimalSchema,
    unitCode: z.string().trim().min(1).max(50),
    unitPrice: nonNegativeMoneySchema,
    classificationCode: z.string().trim().min(1).max(100),
    taxTreatment: documentTaxSubtotalSchema,
    allowances: z.array(allowanceChargeSchema).max(100).default([]),
    charges: z.array(allowanceChargeSchema).max(100).default([]),
    totals: documentLineTotalsSchema,
    itemMetadata: z
      .object({
        name: z.string().trim().min(1).max(500).optional(),
        brand: z.string().trim().min(1).max(200).optional(),
        model: z.string().trim().min(1).max(200).optional(),
        buyerItemReference: z.string().trim().min(1).max(200).optional(),
        sellerItemReference: z.string().trim().min(1).max(200).optional(),
        standardItemReference: z.string().trim().min(1).max(200).optional(),
        countryOfOrigin: z.string().regex(/^[A-Z]{2}$/).optional(),
        tariffCode: z.string().trim().min(1).max(100).optional(),
      })
      .strict(),
  })
  .strict()
  .superRefine((line, context) => {
    if (line.allowances.some((adjustment) => adjustment.type !== "allowance")) {
      context.addIssue({ code: "custom", path: ["allowances"], message: "Line allowances must use allowance type." });
    }
    if (line.charges.some((adjustment) => adjustment.type !== "charge")) {
      context.addIssue({ code: "custom", path: ["charges"], message: "Line charges must use charge type." });
    }
    const moneyValues = [
      line.unitPrice,
      line.taxTreatment.taxableAmount,
      line.taxTreatment.taxAmount,
      ...Object.values(line.totals),
      ...line.allowances.map((adjustment) => adjustment.amount),
      ...line.charges.map((adjustment) => adjustment.amount),
    ];
    if (moneyValues.some((value) => value.currency !== line.unitPrice.currency)) {
      context.addIssue({ code: "custom", message: "All line values must use one currency." });
      return;
    }
    try {
      const expected = calculateDocumentLineTotals({
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        allowances: line.allowances,
        charges: line.charges,
        taxRate: line.taxTreatment.taxRate,
      });
      for (const field of Object.keys(expected) as Array<keyof typeof expected>) {
        if (compareDecimalValues(expected[field].amount, line.totals[field].amount) !== 0) {
          context.addIssue({
            code: "custom",
            path: ["totals", field],
            message: `Expected calculated amount ${expected[field].amount}.`,
          });
        }
      }
      if (compareDecimalValues(expected.taxExclusiveAmount.amount, line.taxTreatment.taxableAmount.amount) !== 0) {
        context.addIssue({ code: "custom", path: ["taxTreatment", "taxableAmount"], message: "Taxable amount must equal line tax-exclusive amount." });
      }
      if (compareDecimalValues(expected.taxAmount.amount, line.taxTreatment.taxAmount.amount) !== 0) {
        context.addIssue({ code: "custom", path: ["taxTreatment", "taxAmount"], message: "Tax amount does not match taxable amount and rate." });
      }
    } catch (error) {
      context.addIssue({ code: "custom", message: error instanceof Error ? error.message : "Line calculation failed." });
    }
  });

export const documentTaxTotalSchema = z
  .object({
    currency: currencyCodeSchema,
    taxAmount: nonNegativeMoneySchema,
    subtotals: z.array(documentTaxSubtotalSchema).min(1).max(1000),
  })
  .strict()
  .superRefine((total, context) => {
    if (total.taxAmount.currency !== total.currency || total.subtotals.some((tax) => tax.taxAmount.currency !== total.currency)) {
      context.addIssue({ code: "custom", message: "Tax total values must use the declared currency." });
    }
    const subtotalAmount = total.subtotals.reduce(
      (sum, tax) => addDecimalValues(sum, tax.taxAmount.amount),
      zero,
    );
    if (compareDecimalValues(subtotalAmount, total.taxAmount.amount) !== 0) {
      context.addIssue({ code: "custom", path: ["taxAmount"], message: "Tax total must equal its grouped subtotals." });
    }
  });

export const documentReferenceSchema = z
  .object({
    type: z.enum(["original_invoice", "purchase_order", "sales_order", "customs_form", "contract", "other"]),
    internalDocumentId: documentIdSchema.optional(),
    myInvoisUuid: z.uuid().optional(),
    externalReference: z.string().trim().min(1).max(200).optional(),
    issueDate: isoDateSchema.optional(),
    description: z.string().trim().min(1).max(500).optional(),
  })
  .strict()
  .refine(
    (reference) => Boolean(reference.internalDocumentId || reference.myInvoisUuid || reference.externalReference),
    "A document reference requires an internal ID, MyInvois UUID, or external reference.",
  );

const documentMonetaryTotalsSchema = z
  .object({
    lineExtensionAmount: nonNegativeMoneySchema,
    allowanceTotal: nonNegativeMoneySchema,
    chargeTotal: nonNegativeMoneySchema,
    taxExclusiveAmount: nonNegativeMoneySchema,
    taxTotal: nonNegativeMoneySchema,
    taxInclusiveAmount: nonNegativeMoneySchema,
    prepaidAmount: nonNegativeMoneySchema,
    roundingAmount: moneyValueSchema,
    payableAmount: nonNegativeMoneySchema,
  })
  .strict();

export const commercialDocumentSchema = z
  .object({
    id: documentIdSchema,
    businessId: businessIdSchema,
    documentType: z.enum([
      "invoice",
      "credit_note",
      "debit_note",
      "refund_note",
      "self_billed_invoice",
      "self_billed_credit_note",
      "self_billed_debit_note",
      "self_billed_refund_note",
    ]),
    internalDocumentNumber: z.string().trim().min(1).max(100),
    issueDate: isoDateSchema,
    issueTime: localTimeSchema,
    supplierPartyId: partyIdSchema,
    buyerPartyId: partyIdSchema,
    shippingRecipientPartyId: partyIdSchema.optional(),
    sourceTransactionIds: z.array(transactionIdSchema).max(1000).default([]),
    currency: currencyCodeSchema,
    taxCurrency: currencyCodeSchema.optional(),
    exchangeRate: positiveDecimalSchema.optional(),
    lines: z.array(documentLineSchema).min(1).max(1000),
    allowances: z.array(allowanceChargeSchema).max(100).default([]),
    charges: z.array(allowanceChargeSchema).max(100).default([]),
    taxTotals: z.array(documentTaxTotalSchema).min(1).max(100),
    monetaryTotals: documentMonetaryTotalsSchema,
    paymentInstructions: z
      .object({
        paymentModeCode: z.string().trim().min(1).max(50),
        bankAccountIdentifier: z.string().trim().min(1).max(200).optional(),
        paymentTerms: z.string().trim().min(1).max(1000).optional(),
        dueDate: isoDateSchema.optional(),
        paymentReference: z.string().trim().min(1).max(200).optional(),
      })
      .strict()
      .optional(),
    billingPeriod: z
      .object({ startDate: isoDateSchema, endDate: isoDateSchema })
      .strict()
      .refine((period) => period.endDate >= period.startDate, { path: ["endDate"], message: "Billing period end cannot precede start." })
      .optional(),
    references: z.array(documentReferenceSchema).max(100).default([]),
    invoicePurpose: z.string().trim().min(1).max(500).optional(),
    notes: z.array(z.string().trim().min(1).max(1000)).max(100).default([]),
    status: z.enum([
      "draft",
      "ready_for_validation",
      "ready_for_submission",
      "submitted",
      "valid",
      "invalid",
      "cancelled",
      "rejected",
    ]),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
    createdBy: userIdSchema.optional(),
    updatedBy: userIdSchema.optional(),
    version: z.number().int().nonnegative().optional(),
  })
  .strict()
  .superRefine((document, context) => {
    const adjustmentTypeMismatch =
      document.allowances.some((adjustment) => adjustment.type !== "allowance") ||
      document.charges.some((adjustment) => adjustment.type !== "charge");
    if (adjustmentTypeMismatch) {
      context.addIssue({ code: "custom", message: "Document allowances and charges must use matching types." });
    }
    const needsOriginal = ["credit_note", "debit_note", "refund_note"].some((type) => document.documentType.endsWith(type));
    if (needsOriginal && !document.references.some((reference) => reference.type === "original_invoice")) {
      context.addIssue({ code: "custom", path: ["references"], message: "Credit, debit, and refund documents must reference an original invoice." });
    }
    if (document.currency !== "MYR" && !document.exchangeRate) {
      context.addIssue({ code: "custom", path: ["exchangeRate"], message: "Foreign-currency documents require an exchange rate." });
    }
    if (document.paymentInstructions?.dueDate && document.paymentInstructions.dueDate < document.issueDate) {
      context.addIssue({ code: "custom", path: ["paymentInstructions", "dueDate"], message: "Due date cannot precede issue date." });
    }
    if (new Set(document.sourceTransactionIds).size !== document.sourceTransactionIds.length) {
      context.addIssue({ code: "custom", path: ["sourceTransactionIds"], message: "Source transaction links must be unique." });
    }
    const monetaryCurrenciesMatch =
      document.lines.every((line) => line.unitPrice.currency === document.currency) &&
      Object.values(document.monetaryTotals).every((value) => value.currency === document.currency);
    if (!monetaryCurrenciesMatch) {
      context.addIssue({ code: "custom", message: "Lines and monetary totals must use document currency." });
      return;
    }
    try {
      if (document.taxTotals.some((total) => total.currency !== document.currency && total.currency !== document.taxCurrency)) {
        context.addIssue({ code: "custom", path: ["taxTotals"], message: "Tax totals must use document or declared tax currency." });
      }
      const expectedTaxTotal = groupDocumentTaxes(document.lines)[0];
      const actualTaxTotal = document.taxTotals.find((total) => total.currency === document.currency);
      if (!actualTaxTotal || compareDecimalValues(expectedTaxTotal.taxAmount.amount, actualTaxTotal.taxAmount.amount) !== 0) {
        context.addIssue({ code: "custom", path: ["taxTotals"], message: "Document-currency tax total must reconcile with line taxes." });
      } else {
        const actualGroups = new Map(actualTaxTotal.subtotals.map((tax) => [
          `${tax.taxTypeCode}:${tax.taxRate}:${tax.exemption?.code ?? ""}:${tax.exemption?.reason ?? ""}`,
          tax,
        ]));
        for (const expectedTax of expectedTaxTotal.subtotals) {
          const key = `${expectedTax.taxTypeCode}:${expectedTax.taxRate}:${expectedTax.exemption?.code ?? ""}:${expectedTax.exemption?.reason ?? ""}`;
          const actualTax = actualGroups.get(key);
          if (
            !actualTax ||
            compareDecimalValues(expectedTax.taxableAmount.amount, actualTax.taxableAmount.amount) !== 0 ||
            compareDecimalValues(expectedTax.taxAmount.amount, actualTax.taxAmount.amount) !== 0
          ) {
            context.addIssue({ code: "custom", path: ["taxTotals"], message: `Tax group ${key} does not reconcile with document lines.` });
          }
        }
        if (actualGroups.size !== expectedTaxTotal.subtotals.length) {
          context.addIssue({ code: "custom", path: ["taxTotals"], message: "Document tax totals contain unexpected groups." });
        }
      }
      const reconciliation = reconcileCommercialDocumentTotals(
        document.lines,
        document.allowances,
        document.charges,
        document.taxTotals,
        document.monetaryTotals,
      );
      for (const field of reconciliation.differences) {
        context.addIssue({
          code: "custom",
          path: ["monetaryTotals", field],
          message: `Expected reconciled amount ${reconciliation.expected[field].amount}.`,
        });
      }
    } catch (error) {
      context.addIssue({ code: "custom", message: error instanceof Error ? error.message : "Document totals could not be reconciled." });
    }
  });
