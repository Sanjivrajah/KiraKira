import type { DecimalString, MoneyValue } from "../common";

export type AllowanceChargeType = "allowance" | "charge";

export interface AllowanceCharge {
  type: AllowanceChargeType;
  reason: string;
  reasonCode?: string;
  percentage?: DecimalString;
  baseAmount?: MoneyValue;
  amount: MoneyValue;
}
