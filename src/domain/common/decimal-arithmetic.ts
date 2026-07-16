import { decimalStringSchema, type CurrencyCode, type DecimalString, type MoneyValue } from "./money";

interface ParsedDecimal {
  coefficient: bigint;
  scale: number;
}

function assertFractionDigits(fractionDigits: number) {
  if (!Number.isInteger(fractionDigits) || fractionDigits < 0 || fractionDigits > 20) {
    throw new RangeError("Fraction digits must be an integer between 0 and 20.");
  }
}

function powerOfTen(exponent: number): bigint {
  return BigInt(`1${"0".repeat(exponent)}`);
}

function parseDecimal(value: DecimalString): ParsedDecimal {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [whole, fraction = ""] = unsigned.split(".");
  const digits = `${whole}${fraction}`.replace(/^0+(?=\d)/, "");
  const sign = negative ? BigInt(-1) : BigInt(1);
  return { coefficient: BigInt(digits || "0") * sign, scale: fraction.length };
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
  assertFractionDigits(fractionDigits);
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
  return {
    coefficient: absoluteRemainder * BigInt(2) >= divisor ? quotient + direction : quotient,
    scale: fractionDigits,
  };
}

function formatDecimal(value: ParsedDecimal): DecimalString {
  const negative = value.coefficient < BigInt(0);
  const absolute = negative ? -value.coefficient : value.coefficient;
  const digits = absolute.toString().padStart(value.scale + 1, "0");
  const formatted = value.scale === 0
    ? digits
    : `${digits.slice(0, -value.scale)}.${digits.slice(-value.scale)}`;
  return decimalStringSchema.parse(`${negative ? "-" : ""}${formatted}`);
}

function multiplyParsed(left: DecimalString, right: DecimalString): ParsedDecimal {
  const parsedLeft = parseDecimal(left);
  const parsedRight = parseDecimal(right);
  return {
    coefficient: parsedLeft.coefficient * parsedRight.coefficient,
    scale: parsedLeft.scale + parsedRight.scale,
  };
}

export function addDecimalValues(left: DecimalString, right: DecimalString): DecimalString {
  const [leftCoefficient, rightCoefficient, scale] = align(parseDecimal(left), parseDecimal(right));
  return formatDecimal({ coefficient: leftCoefficient + rightCoefficient, scale });
}

export function subtractDecimalValues(left: DecimalString, right: DecimalString): DecimalString {
  const [leftCoefficient, rightCoefficient, scale] = align(parseDecimal(left), parseDecimal(right));
  return formatDecimal({ coefficient: leftCoefficient - rightCoefficient, scale });
}

export function multiplyDecimalValues(
  left: DecimalString,
  right: DecimalString,
  fractionDigits = 2,
): DecimalString {
  return formatDecimal(roundCoefficient(multiplyParsed(left, right), fractionDigits));
}

export function compareDecimalValues(left: DecimalString, right: DecimalString): number {
  const [leftCoefficient, rightCoefficient] = align(parseDecimal(left), parseDecimal(right));
  return leftCoefficient < rightCoefficient ? -1 : leftCoefficient > rightCoefficient ? 1 : 0;
}

export function roundDecimalValue(value: DecimalString, fractionDigits = 2): DecimalString {
  return formatDecimal(roundCoefficient(parseDecimal(value), fractionDigits));
}

export function percentageOfMoney(
  value: MoneyValue,
  percentage: DecimalString,
  fractionDigits = 2,
): MoneyValue {
  const product = multiplyParsed(value.amount, percentage);
  return {
    amount: formatDecimal(roundCoefficient({ coefficient: product.coefficient, scale: product.scale + 2 }, fractionDigits)),
    currency: value.currency,
  };
}

export function sumMoneyValues(
  values: MoneyValue[],
  currency: CurrencyCode,
  fractionDigits = 2,
): MoneyValue {
  if (values.some((value) => value.currency !== currency)) {
    throw new RangeError("All money values in a calculation must use the requested currency.");
  }
  const total = values.reduce<DecimalString>(
    (sum, value) => addDecimalValues(sum, value.amount),
    decimalStringSchema.parse("0"),
  );
  return { amount: roundDecimalValue(total, fractionDigits), currency };
}
