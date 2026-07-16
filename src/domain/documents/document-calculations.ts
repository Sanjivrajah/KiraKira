import {
  addDecimalValues,
  compareDecimalValues,
  decimalStringSchema,
  multiplyDecimalValues,
  percentageOfMoney,
  roundDecimalValue,
  subtractDecimalValues,
  sumMoneyValues,
  type CurrencyCode,
  type DecimalString,
  type MoneyValue,
} from "../common";
import type { AllowanceCharge } from "./allowance-charge";
import type { DocumentLine, DocumentLineTotals } from "./document-line";
import type { DocumentMonetaryTotals } from "./commercial-document";
import type { DocumentTaxSubtotal, DocumentTaxTotal } from "./tax-total";

const zero = decimalStringSchema.parse("0");

function money(amount: DecimalString, currency: CurrencyCode): MoneyValue {
  return { amount: roundDecimalValue(amount), currency };
}

function assertNonNegative(value: DecimalString, message: string) {
  if (compareDecimalValues(value, zero) < 0) throw new RangeError(message);
}

export function calculateAllowanceChargeAmount(adjustment: AllowanceCharge): MoneyValue {
  if (adjustment.percentage && adjustment.baseAmount) {
    return percentageOfMoney(adjustment.baseAmount, adjustment.percentage);
  }
  return adjustment.amount;
}

export function calculateDocumentLineTotals(input: {
  quantity: DecimalString;
  unitPrice: MoneyValue;
  allowances?: AllowanceCharge[];
  charges?: AllowanceCharge[];
  taxRate: DecimalString;
}): DocumentLineTotals {
  const allowances = input.allowances ?? [];
  const charges = input.charges ?? [];
  const currency = input.unitPrice.currency;
  const lineExtensionAmount = {
    amount: multiplyDecimalValues(input.quantity, input.unitPrice.amount),
    currency,
  };
  const allowanceTotal = sumMoneyValues(allowances.map(calculateAllowanceChargeAmount), currency);
  const chargeTotal = sumMoneyValues(charges.map(calculateAllowanceChargeAmount), currency);
  const exclusiveAmount = addDecimalValues(
    subtractDecimalValues(lineExtensionAmount.amount, allowanceTotal.amount),
    chargeTotal.amount,
  );
  assertNonNegative(exclusiveAmount, "Line allowances cannot exceed extension amount plus charges.");
  const taxExclusiveAmount = money(exclusiveAmount, currency);
  const taxAmount = percentageOfMoney(taxExclusiveAmount, input.taxRate);
  const taxInclusiveAmount = money(
    addDecimalValues(taxExclusiveAmount.amount, taxAmount.amount),
    currency,
  );
  return {
    lineExtensionAmount,
    allowanceTotal,
    chargeTotal,
    taxExclusiveAmount,
    taxAmount,
    taxInclusiveAmount,
  };
}

export function groupDocumentTaxes(lines: DocumentLine[]): DocumentTaxTotal[] {
  if (lines.length === 0) return [];
  const currency = lines[0].unitPrice.currency;
  const grouped = new Map<string, DocumentTaxSubtotal[]>();
  for (const line of lines) {
    const tax = line.taxTreatment;
    const key = `${tax.taxTypeCode}:${tax.taxRate}:${tax.exemption?.code ?? ""}:${tax.exemption?.reason ?? ""}`;
    grouped.set(key, [...(grouped.get(key) ?? []), tax]);
  }
  const subtotals = [...grouped.values()].map((group) => ({
    taxTypeCode: group[0].taxTypeCode,
    taxRate: group[0].taxRate,
    taxableAmount: sumMoneyValues(group.map((tax) => tax.taxableAmount), currency),
    taxAmount: sumMoneyValues(group.map((tax) => tax.taxAmount), currency),
    exemption: group[0].exemption,
  }));
  return [{
    currency,
    taxAmount: sumMoneyValues(subtotals.map((subtotal) => subtotal.taxAmount), currency),
    subtotals,
  }];
}

export function calculateDocumentMonetaryTotals(input: {
  lines: DocumentLine[];
  allowances?: AllowanceCharge[];
  charges?: AllowanceCharge[];
  taxTotals?: DocumentTaxTotal[];
  prepaidAmount?: MoneyValue;
  roundingAmount?: MoneyValue;
}): DocumentMonetaryTotals {
  if (input.lines.length === 0) throw new RangeError("At least one document line is required.");
  const currency = input.lines[0].unitPrice.currency;
  const lineExtensionAmount = sumMoneyValues(
    input.lines.map((line) => line.totals.taxExclusiveAmount),
    currency,
  );
  const allowanceTotal = sumMoneyValues((input.allowances ?? []).map(calculateAllowanceChargeAmount), currency);
  const chargeTotal = sumMoneyValues((input.charges ?? []).map(calculateAllowanceChargeAmount), currency);
  const taxExclusiveRaw = addDecimalValues(
    subtractDecimalValues(lineExtensionAmount.amount, allowanceTotal.amount),
    chargeTotal.amount,
  );
  assertNonNegative(taxExclusiveRaw, "Document allowances cannot exceed line amount plus charges.");
  const taxExclusiveAmount = money(taxExclusiveRaw, currency);
  const taxTotal = sumMoneyValues(
    (input.taxTotals ?? groupDocumentTaxes(input.lines))
      .filter((total) => total.currency === currency)
      .map((total) => total.taxAmount),
    currency,
  );
  const taxInclusiveAmount = money(addDecimalValues(taxExclusiveAmount.amount, taxTotal.amount), currency);
  const prepaidAmount = input.prepaidAmount ?? money(zero, currency);
  const roundingAmount = input.roundingAmount ?? money(zero, currency);
  const payableRaw = subtractDecimalValues(
    addDecimalValues(taxInclusiveAmount.amount, roundingAmount.amount),
    prepaidAmount.amount,
  );
  assertNonNegative(payableRaw, "Prepaid amount cannot exceed the rounded tax-inclusive amount.");
  return {
    lineExtensionAmount,
    allowanceTotal,
    chargeTotal,
    taxExclusiveAmount,
    taxTotal,
    taxInclusiveAmount,
    prepaidAmount,
    roundingAmount,
    payableAmount: money(payableRaw, currency),
  };
}

export function reconcileCommercialDocumentTotals(
  lines: DocumentLine[],
  allowances: AllowanceCharge[],
  charges: AllowanceCharge[],
  taxTotals: DocumentTaxTotal[],
  actual: DocumentMonetaryTotals,
) {
  const expected = calculateDocumentMonetaryTotals({
    lines,
    allowances,
    charges,
    taxTotals,
    prepaidAmount: actual.prepaidAmount,
    roundingAmount: actual.roundingAmount,
  });
  const fields = Object.keys(expected) as Array<keyof DocumentMonetaryTotals>;
  const differences = fields.filter((field) =>
    expected[field].currency !== actual[field].currency ||
    compareDecimalValues(expected[field].amount, actual[field].amount) !== 0,
  );
  return { matches: differences.length === 0, differences, expected };
}
