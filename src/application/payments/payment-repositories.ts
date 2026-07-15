import type { BusinessId, DocumentId, Payment, PaymentAllocation, PaymentAllocationId, PaymentId } from "@/domain";
import type { BusinessScopedRepository } from "../shared/repository";

export interface PaymentRepository extends BusinessScopedRepository<Payment, PaymentId> {
  findByExternalReference(businessId: BusinessId, externalReference: string): Promise<Payment | null>;
}

export interface PaymentAllocationRepository extends BusinessScopedRepository<PaymentAllocation, PaymentAllocationId> {
  listForPayment(businessId: BusinessId, paymentId: PaymentId): Promise<readonly PaymentAllocation[]>;
  listForDocument(businessId: BusinessId, documentId: DocumentId): Promise<readonly PaymentAllocation[]>;
}
