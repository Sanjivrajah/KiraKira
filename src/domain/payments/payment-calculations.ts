import {
  compareDecimalValues,
  decimalStringSchema,
  roundDecimalValue,
  subtractDecimalValues,
  sumMoneyValues,
  type DocumentId,
  type ISODate,
  type MoneyValue,
} from "../common";
import type { PaymentAllocation } from "./payment-allocation";
import type { Payment } from "./payment";

export type DocumentSettlementStatus = "unpaid" | "partially_paid" | "paid";
export type EffectiveDocumentPaymentStatus = DocumentSettlementStatus | "overdue";

export interface DocumentPaymentState {
  settlementStatus: DocumentSettlementStatus;
  effectiveStatus: EffectiveDocumentPaymentStatus;
  overdue: boolean;
  allocatedAmount: MoneyValue;
  outstandingAmount: MoneyValue;
}

export function deriveDocumentPaymentState(input: {
  documentId: DocumentId;
  payableAmount: MoneyValue;
  dueDate?: ISODate;
  allocations: PaymentAllocation[];
  payments: Payment[];
  asOfDate: ISODate;
}): DocumentPaymentState {
  const completedPaymentIds = new Set(
    input.payments.filter((payment) => payment.status === "completed").map((payment) => payment.id),
  );
  const applicableAllocations = input.allocations.filter(
    (allocation) => allocation.documentId === input.documentId && completedPaymentIds.has(allocation.paymentId),
  );
  const allocatedAmount = sumMoneyValues(
    applicableAllocations.map((allocation) => allocation.allocatedAmount),
    input.payableAmount.currency,
  );
  const comparison = compareDecimalValues(allocatedAmount.amount, input.payableAmount.amount);
  const settlementStatus: DocumentSettlementStatus = comparison >= 0
    ? "paid"
    : compareDecimalValues(allocatedAmount.amount, decimalStringSchema.parse("0")) > 0
      ? "partially_paid"
      : "unpaid";
  const outstandingAmount = {
    amount: comparison >= 0
      ? roundDecimalValue(decimalStringSchema.parse("0"))
      : roundDecimalValue(subtractDecimalValues(input.payableAmount.amount, allocatedAmount.amount)),
    currency: input.payableAmount.currency,
  };
  const overdue = settlementStatus !== "paid" && Boolean(input.dueDate && input.asOfDate > input.dueDate);
  return {
    settlementStatus,
    effectiveStatus: overdue ? "overdue" : settlementStatus,
    overdue,
    allocatedAmount,
    outstandingAmount,
  };
}

export function reconcilePaymentAllocations(payment: Payment, allocations: PaymentAllocation[]) {
  const applicable = allocations.filter((allocation) => allocation.paymentId === payment.id);
  const allocatedAmount = sumMoneyValues(
    applicable.map((allocation) => allocation.allocatedAmount),
    payment.amount.currency,
  );
  const overAllocated = compareDecimalValues(allocatedAmount.amount, payment.amount.amount) > 0;
  return { allocatedAmount, overAllocated };
}
