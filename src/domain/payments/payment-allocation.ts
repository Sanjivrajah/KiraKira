import type {
  AuditableEntity,
  DocumentId,
  ISODateTime,
  MoneyValue,
  PaymentAllocationId,
  PaymentId,
} from "../common";

export interface PaymentAllocation extends Omit<AuditableEntity, "id"> {
  id: PaymentAllocationId;
  paymentId: PaymentId;
  documentId: DocumentId;
  allocatedAmount: MoneyValue;
  allocatedAt: ISODateTime;
  notes?: string;
}
