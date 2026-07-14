import type { CurrencyCode, DecimalString, MoneyValue } from "./money";
import { decimalStringSchema } from "./money";

interface ParsedDecimal {
  coefficient: bigint;
  scale: number;
}

const powerOfTen = (exponent: number) => BigInt(`1${"0".repeat(exponent)}`);

function parse(value: DecimalString): ParsedDecimal {
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = (negative ? value.slice(1) : value).split(".");
  const coefficient = BigInt(`${whole}${fraction}` || "0") * (negative ? BigInt(-1) : BigInt(1));
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

function roundParsed(value: ParsedDecimal, fractionDigits: number): ParsedDecimal {
  if (value.scale <= fractionDigits) {
    return { coefficient: value.coefficient * powerOfTen(fractionDigits - value.scale), scale: fractionDigits };
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

function format(value: ParsedDecimal): DecimalString {
  const negative = value.coefficient < BigInt(0);
  const digits = (negative ? -value.coefficient : value.coefficient).toString().padStart(value.scale + 1, "0");
  const amount = value.scale === 0 ? digits : `${digits.slice(0, -value.scale)}.${digits.slice(-value.scale)}`;
  return decimalStringSchema.parse(`${negative ? "-" : ""}${amount}`);
}

export function compareDecimalValues(left: DecimalString, right: DecimalString): number {
  const [leftCoefficient, rightCoefficient] = align(parse(left), parse(right));
  return leftCoefficient < rightCoefficient ? -1 : leftCoefficient > rightCoefficient ? 1 : 0;
}

export function addDecimalValues(left: DecimalString, right: DecimalString): DecimalString {
  const [leftCoefficient, rightCoefficient, scale] = align(parse(left), parse(right));
  return format({ coefficient: leftCoefficient + rightCoefficient, scale });
}

export function subtractDecimalValues(left: DecimalString, right: DecimalString): DecimalString {
  const [leftCoefficient, rightCoefficient, scale] = align(parse(left), parse(right));
  return format({ coefficient: leftCoefficient - rightCoefficient, scale });
}

export function multiplyDecimalValues(
  left: DecimalString,
  right: DecimalString,
  fractionDigits = 2,
): DecimalString {
  const parsedLeft = parse(left);
  const parsedRight = parse(right);
  return format(roundParsed({
    coefficient: parsedLeft.coefficient * parsedRight.coefficient,
    scale: parsedLeft.scale + parsedRight.scale,
  }, fractionDigits));
}

export function roundDecimalValue(value: DecimalString, fractionDigits = 2): DecimalString {
  return format(roundParsed(parse(value), fractionDigits));
}

export function sumMoneyValues(
  values: MoneyValue[],
  currency: CurrencyCode,
  fractionDigits = 2,
): MoneyValue {
  if (values.some((value) => value.currency !== currency)) {
    throw new RangeError("All money values must use the requested currency.");
  }
  const amount = values.reduce(
    (total, value) => addDecimalValues(total, value.amount),
    decimalStringSchema.parse("0"),
  );
  return { amount: roundDecimalValue(amount, fractionDigits), currency };
}

export function percentageOfMoney(
  baseAmount: MoneyValue,
  percentage: DecimalString,
  fractionDigits = 2,
): MoneyValue {
  const product = multiplyDecimalValues(baseAmount.amount, percentage, fractionDigits + 2);
  const amount = multiplyDecimalValues(product, decimalStringSchema.parse("0.01"), fractionDigits);
  return { amount, currency: baseAmount.currency };
}
