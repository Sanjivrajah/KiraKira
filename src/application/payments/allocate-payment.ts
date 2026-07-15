import {
  addDecimalValues,
  compareDecimalValues,
  decimalStringSchema,
  paymentAllocationSchema,
  reconcilePaymentAllocations,
  type BusinessId,
  type PaymentAllocation,
} from "@/domain";
import type { CommercialDocumentRepository } from "../documents/commercial-document-repository";
import { ApplicationError } from "../shared/repository";
import type { PaymentAllocationRepository, PaymentRepository } from "./payment-repositories";

export interface AllocatePaymentCommand {
  businessId: BusinessId;
  allocation: PaymentAllocation;
  idempotencyKey: string;
}

export class AllocatePaymentService {
  constructor(
    private readonly payments: PaymentRepository,
    private readonly allocations: PaymentAllocationRepository,
    private readonly documents: CommercialDocumentRepository,
  ) {}

  async execute(command: AllocatePaymentCommand): Promise<PaymentAllocation> {
    const existing = await this.allocations.findByIdempotencyKey(command.businessId, command.idempotencyKey);
    if (existing) return existing;
    const allocation = paymentAllocationSchema.parse(command.allocation);
    const [payment, document] = await Promise.all([
      this.payments.getById(command.businessId, allocation.paymentId),
      this.documents.getById(command.businessId, allocation.documentId),
    ]);
    if (!payment || !document) throw new ApplicationError("payment.target_not_found", "Payment and document must belong to the same business.");
    if (payment.status !== "completed") throw new ApplicationError("payment.not_completed", "Only completed payments can be allocated.");
    if (allocation.allocatedAmount.currency !== payment.amount.currency || allocation.allocatedAmount.currency !== document.currency) {
      throw new ApplicationError("payment.currency_mismatch", "Payment, allocation, and document must use one currency.");
    }
    const paymentAllocations = [...await this.allocations.listForPayment(command.businessId, payment.id), allocation];
    if (reconcilePaymentAllocations(payment, paymentAllocations).overAllocated) {
      throw new ApplicationError("payment.overallocated", "Allocations cannot exceed the payment amount.");
    }
    const documentAllocations = await this.allocations.listForDocument(command.businessId, document.id);
    const alreadyAllocated = documentAllocations.reduce(
      (sum, item) => addDecimalValues(sum, item.allocatedAmount.amount),
      decimalStringSchema.parse("0"),
    );
    const nextDocumentAllocation = addDecimalValues(alreadyAllocated, allocation.allocatedAmount.amount);
    if (compareDecimalValues(nextDocumentAllocation, document.monetaryTotals.payableAmount.amount) > 0) {
      throw new ApplicationError("document.overpaid", "Allocations cannot exceed the document payable amount.");
    }
    return this.allocations.save(command.businessId, allocation, { idempotencyKey: command.idempotencyKey });
  }
}
