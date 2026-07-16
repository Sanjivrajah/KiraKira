import type { ISODate, ISODateTime } from "@/domain";

export type MyInvoisCodeSetName =
  | "classification"
  | "country"
  | "currency"
  | "invoice_type"
  | "msic"
  | "payment_mode"
  | "state"
  | "tax_type"
  | "unit_of_measurement";

export interface MyInvoisReferenceCode {
  codeSet: MyInvoisCodeSetName;
  code: string;
  description: string;
  active: boolean;
  effectiveFrom?: ISODate;
  effectiveTo?: ISODate;
  sourceVersion: string;
  syncedAt: ISODateTime;
}
