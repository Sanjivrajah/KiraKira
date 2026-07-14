import type {
  AuditableEntity,
  BusinessId,
  ISODateTime,
  MoneyValue,
  PaymentId,
} from "../common";

export type PaymentStatus = "pending" | "completed" | "failed" | "cancelled" | "refunded";

export interface Payment extends Omit<AuditableEntity, "id"> {
  id: PaymentId;
  businessId: BusinessId;
  paymentDate: ISODateTime;
  amount: MoneyValue;
  paymentModeCode: string;
  bankReference?: string;
  externalReference?: string;
  status: PaymentStatus;
}
