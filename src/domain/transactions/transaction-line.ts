import type { DecimalString, EntityId, MoneyValue } from "../common";

export interface LineDiscount {
  amount: MoneyValue;
  reason?: string;
}

export interface LineCharge {
  amount: MoneyValue;
  reason?: string;
}

export interface TaxExemption {
  code?: string;
  reason: string;
}

export interface TransactionTaxTreatment {
  taxTypeCode: string;
  taxRate: DecimalString;
  taxableAmount: MoneyValue;
  taxAmount: MoneyValue;
  exemption?: TaxExemption;
}

export interface TransactionLine {
  id: EntityId;
  itemReference?: string;
  description: string;
  quantity: DecimalString;
  unitCode: string;
  unitPrice: MoneyValue;
  classificationCode?: string;
  discount?: LineDiscount;
  charges: LineCharge[];
  taxTreatment: TransactionTaxTreatment;
  subtotal: MoneyValue;
  totalExcludingTax: MoneyValue;
  totalIncludingTax: MoneyValue;
  countryOfOrigin?: string;
  tariffCode?: string;
}
