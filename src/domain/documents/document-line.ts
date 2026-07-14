import type { DecimalString, EntityId, MoneyValue } from "../common";
import type { AllowanceCharge } from "./allowance-charge";
import type { DocumentTaxSubtotal } from "./tax-total";

export interface DocumentItemMetadata {
  name?: string;
  brand?: string;
  model?: string;
  buyerItemReference?: string;
  sellerItemReference?: string;
  standardItemReference?: string;
  countryOfOrigin?: string;
  tariffCode?: string;
}

export interface DocumentLineTotals {
  lineExtensionAmount: MoneyValue;
  allowanceTotal: MoneyValue;
  chargeTotal: MoneyValue;
  taxExclusiveAmount: MoneyValue;
  taxAmount: MoneyValue;
  taxInclusiveAmount: MoneyValue;
}

export interface DocumentLine {
  id: EntityId;
  description: string;
  quantity: DecimalString;
  unitCode: string;
  unitPrice: MoneyValue;
  classificationCode: string;
  taxTreatment: DocumentTaxSubtotal;
  allowances: AllowanceCharge[];
  charges: AllowanceCharge[];
  totals: DocumentLineTotals;
  itemMetadata: DocumentItemMetadata;
}
