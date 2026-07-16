import type { Payment } from "@/types";

export interface PaymentRepository {
  list(input: { businessId: string; invoiceId?: string }): Promise<Payment[]>;
  getById(input: { businessId: string; paymentId: string }): Promise<Payment | null>;
  create(input: { payment: Payment }): Promise<Payment>;
  update(input: { businessId: string; paymentId: string; changes: Partial<Payment> }): Promise<Payment>;
  remove(input: { businessId: string; paymentId: string }): Promise<void>;
  clearForBusiness(input: { businessId: string }): Promise<void>;
  clear(): Promise<void>;
}
