import type { CurrencyCode, DecimalString, MoneyValue } from "../common";
import { decimalStringSchema } from "../common";
import type { TransactionLine } from "./transaction-line";
import type { TransactionTotals } from "./transaction-totals";

interface ParsedDecimal {
  coefficient: bigint;
  scale: number;
}

function powerOfTen(exponent: number): bigint {
  return BigInt(`1${"0".repeat(exponent)}`);
}

function parseDecimal(value: DecimalString): ParsedDecimal {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [whole, fraction = ""] = unsigned.split(".");
  const digits = `${whole}${fraction}`.replace(/^0+(?=\d)/, "");
  const coefficient = BigInt(digits || "0") * (negative ? BigInt(-1) : BigInt(1));
  return { coefficient, scale: fraction.length };
}

function align(left: ParsedDecimal, right: ParsedDecimal): [bigint, bigint, number] {
  const scale = Math.max(left.scale, right.scale);
  return [
    left.coefficient * powerOfTen(scale - left.scale),
    right.coefficient * powerOfTen(scale - right.scale),
    scale,
  ];
}

function roundCoefficient(value: ParsedDecimal, fractionDigits: number): ParsedDecimal {
  if (value.scale <= fractionDigits) {
    return {
      coefficient: value.coefficient * powerOfTen(fractionDigits - value.scale),
      scale: fractionDigits,
    };
  }

  const divisor = powerOfTen(value.scale - fractionDigits);
  const quotient = value.coefficient / divisor;
  const remainder = value.coefficient % divisor;
  const absoluteRemainder = remainder < BigInt(0) ? -remainder : remainder;
  const direction = value.coefficient < BigInt(0) ? BigInt(-1) : BigInt(1);
  const rounded = absoluteRemainder * BigInt(2) >= divisor ? quotient + direction : quotient;
  return { coefficient: rounded, scale: fractionDigits };
}

function formatDecimal(value: ParsedDecimal): DecimalString {
  const negative = value.coefficient < BigInt(0);
  const digits = (negative ? -value.coefficient : value.coefficient).toString().padStart(value.scale + 1, "0");
  const formatted = value.scale === 0
    ? digits
    : `${digits.slice(0, -value.scale)}.${digits.slice(-value.scale)}`;
  return decimalStringSchema.parse(`${negative ? "-" : ""}${formatted}`);
}

function addDecimals(left: DecimalString, right: DecimalString): DecimalString {
  const [leftCoefficient, rightCoefficient, scale] = align(parseDecimal(left), parseDecimal(right));
  return formatDecimal({ coefficient: leftCoefficient + rightCoefficient, scale });
}

function subtractDecimals(left: DecimalString, right: DecimalString): DecimalString {
  const [leftCoefficient, rightCoefficient, scale] = align(parseDecimal(left), parseDecimal(right));
  return formatDecimal({ coefficient: leftCoefficient - rightCoefficient, scale });
}

function multiplyDecimals(left: DecimalString, right: DecimalString): ParsedDecimal {
  const parsedLeft = parseDecimal(left);
  const parsedRight = parseDecimal(right);
  return {
    coefficient: parsedLeft.coefficient * parsedRight.coefficient,
    scale: parsedLeft.scale + parsedRight.scale,
  };
}

export function compareDecimalStrings(left: DecimalString, right: DecimalString): number {
  const [leftCoefficient, rightCoefficient] = align(parseDecimal(left), parseDecimal(right));
  return leftCoefficient < rightCoefficient ? -1 : leftCoefficient > rightCoefficient ? 1 : 0;
}

function assertSameCurrency(values: MoneyValue[]): CurrencyCode {
  const currency = values[0]?.currency;
  if (!currency || values.some((value) => value.currency !== currency)) {
    throw new RangeError("All money values in a calculation must use the same currency.");
  }
  return currency;
}

function sumMoney(values: MoneyValue[], currency: CurrencyCode, fractionDigits = 2): MoneyValue {
  const amount = values.reduce<DecimalString>(
    (total, value) => addDecimals(total, value.amount),
    decimalStringSchema.parse("0"),
  );
  return { amount: formatDecimal(roundCoefficient(parseDecimal(amount), fractionDigits)), currency };
}

export function calculateLineSubtotal(
  quantity: DecimalString,
  unitPrice: MoneyValue,
  fractionDigits = 2,
): MoneyValue {
  return {
    amount: formatDecimal(roundCoefficient(multiplyDecimals(quantity, unitPrice.amount), fractionDigits)),
    currency: unitPrice.currency,
  };
}

export function calculateLineTax(
  taxableAmount: MoneyValue,
  taxRate: DecimalString,
  fractionDigits = 2,
): MoneyValue {
  const product = multiplyDecimals(taxableAmount.amount, taxRate);
  return {
    amount: formatDecimal(roundCoefficient({ coefficient: product.coefficient, scale: product.scale + 2 }, fractionDigits)),
    currency: taxableAmount.currency,
  };
}

export function calculateLineTotal(
  input: {
    subtotal: MoneyValue;
    discount?: MoneyValue;
    charges?: MoneyValue[];
    taxAmount: MoneyValue;
  },
  fractionDigits = 2,
): MoneyValue {
  const values = [input.subtotal, input.taxAmount, ...(input.discount ? [input.discount] : []), ...(input.charges ?? [])];
  const currency = assertSameCurrency(values);
  const charges = sumMoney(input.charges ?? [], currency, fractionDigits);
  const beforeTax = addDecimals(
    subtractDecimals(input.subtotal.amount, input.discount?.amount ?? decimalStringSchema.parse("0")),
    charges.amount,
  );
  if (compareDecimalStrings(beforeTax, decimalStringSchema.parse("0")) < 0) {
    throw new RangeError("Line discounts cannot exceed subtotal plus charges.");
  }
  return {
    amount: formatDecimal(
      roundCoefficient(parseDecimal(addDecimals(beforeTax, input.taxAmount.amount)), fractionDigits),
    ),
    currency,
  };
}

export function calculateTransactionTotals(
  lines: TransactionLine[],
  roundingAmount?: MoneyValue,
  fractionDigits = 2,
): TransactionTotals {
  if (lines.length === 0) {
    throw new RangeError("At least one transaction line is required to calculate totals.");
  }

  const allMoney = lines.flatMap((line) => [
    line.subtotal,
    line.totalExcludingTax,
    line.totalIncludingTax,
    line.taxTreatment.taxAmount,
    ...(line.discount ? [line.discount.amount] : []),
    ...line.charges.map((charge) => charge.amount),
  ]);
  const currency = assertSameCurrency(roundingAmount ? [...allMoney, roundingAmount] : allMoney);
  const rounding = roundingAmount ?? {
    amount: formatDecimal(roundCoefficient(parseDecimal(decimalStringSchema.parse("0")), fractionDigits)),
    currency,
  };
  const lineExtensionAmount = sumMoney(lines.map((line) => line.subtotal), currency, fractionDigits);
  const allowanceTotal = sumMoney(lines.flatMap((line) => line.discount ? [line.discount.amount] : []), currency, fractionDigits);
  const chargeTotal = sumMoney(lines.flatMap((line) => line.charges.map((charge) => charge.amount)), currency, fractionDigits);
  const taxExclusiveAmount = sumMoney(lines.map((line) => line.totalExcludingTax), currency, fractionDigits);
  const taxTotal = sumMoney(lines.map((line) => line.taxTreatment.taxAmount), currency, fractionDigits);
  const taxInclusiveAmount = sumMoney(lines.map((line) => line.totalIncludingTax), currency, fractionDigits);
  const payableAmount = sumMoney([taxInclusiveAmount, rounding], currency, fractionDigits);

  return {
    lineExtensionAmount,
    allowanceTotal,
    chargeTotal,
    taxExclusiveAmount,
    taxTotal,
    taxInclusiveAmount,
    roundingAmount: rounding,
    payableAmount,
  };
}

export interface TotalReconciliationDifference {
  field: keyof TransactionTotals;
  expected: MoneyValue;
  actual: MoneyValue;
}

export interface TotalReconciliationResult {
  matches: boolean;
  differences: TotalReconciliationDifference[];
}

export function reconcileTransactionTotals(
  lines: TransactionLine[],
  actual: TransactionTotals,
  fractionDigits = 2,
): TotalReconciliationResult {
  const expected = calculateTransactionTotals(lines, actual.roundingAmount, fractionDigits);
  const fields = Object.keys(expected) as Array<keyof TransactionTotals>;
  const differences = fields.flatMap((field) => {
    const expectedValue = expected[field];
    const actualValue = actual[field];
    return expectedValue.currency !== actualValue.currency ||
      compareDecimalStrings(expectedValue.amount, actualValue.amount) !== 0
      ? [{ field, expected: expectedValue, actual: actualValue }]
      : [];
  });
  return { matches: differences.length === 0, differences };
}
