import type { CurrencyCode } from "@/types";

export interface MoneyFormatOptions {
  currency?: CurrencyCode;
  locale?: string;
}

const formatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(
  amount: number,
  { currency = "MYR", locale = "en-MY" }: MoneyFormatOptions = {},
): string {
  if (!Number.isFinite(amount)) return "Amount unavailable";
  const key = `${locale}:${currency}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    formatters.set(key, formatter);
  }
  return formatter.format(amount);
}
