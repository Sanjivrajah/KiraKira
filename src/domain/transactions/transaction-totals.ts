import type { MoneyValue } from "../common";

export interface TransactionTotals {
  lineExtensionAmount: MoneyValue;
  allowanceTotal: MoneyValue;
  chargeTotal: MoneyValue;
  taxExclusiveAmount: MoneyValue;
  taxTotal: MoneyValue;
  taxInclusiveAmount: MoneyValue;
  roundingAmount: MoneyValue;
  payableAmount: MoneyValue;
}
