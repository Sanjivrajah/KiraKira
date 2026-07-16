import type { AuditableEntity, CurrencyCode, EntityId, ISODateTimeString, MoneyAmount } from "./common";

export type PaymentStatus = "pending" | "completed" | "failed" | "refunded";

export interface Payment extends AuditableEntity {
  businessId: EntityId;
  invoiceId: EntityId;
  amount: MoneyAmount;
  currency: CurrencyCode;
  paidAt: ISODateTimeString;
  method?: string | null;
  reference?: string | null;
  status: PaymentStatus;
}
