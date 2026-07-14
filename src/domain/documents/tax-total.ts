import type { CurrencyCode, DecimalString, MoneyValue } from "../common";

export interface DocumentTaxExemption {
  code?: string;
  reason: string;
}

export interface DocumentTaxSubtotal {
  taxTypeCode: string;
  taxRate: DecimalString;
  taxableAmount: MoneyValue;
  taxAmount: MoneyValue;
  exemption?: DocumentTaxExemption;
}

export interface DocumentTaxTotal {
  currency: CurrencyCode;
  taxAmount: MoneyValue;
  subtotals: DocumentTaxSubtotal[];
}
