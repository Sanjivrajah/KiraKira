import { z } from "zod";

declare const moneyBrand: unique symbol;

export type DecimalString = string & { readonly [moneyBrand]: "DecimalString" };
export type CurrencyCode = string & { readonly [moneyBrand]: "CurrencyCode" };

export interface MoneyValue {
  amount: DecimalString;
  currency: CurrencyCode;
}

const DECIMAL_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

export const decimalStringSchema = z
  .string()
  .regex(DECIMAL_PATTERN, "Use a plain decimal string without commas or exponent notation.")
  .transform((value) => value as DecimalString);

export const currencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/, "Use a three-letter uppercase currency code.")
  .transform((value) => value as CurrencyCode);

export const moneyValueSchema = z
  .object({
    amount: decimalStringSchema,
    currency: currencyCodeSchema,
  })
  .strict();

/** Convert for presentation only. Never persist or calculate authoritative totals with this value. */
export function decimalToDisplayNumber(value: DecimalString): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new RangeError("Decimal value is outside the displayable number range.");
  }
  return parsed;
}

/** Convert a money amount for presentation only. */
export function moneyToDisplayNumber(value: MoneyValue): number {
  return decimalToDisplayNumber(value.amount);
}
