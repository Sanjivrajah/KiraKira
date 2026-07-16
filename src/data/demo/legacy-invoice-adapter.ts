import {
  deriveDocumentPaymentState,
  isoDateSchema,
  moneyToDisplayNumber,
  type CommercialDocument,
  type Payment,
  type PaymentAllocation,
} from "@/domain";
import type { Invoice } from "@/types";

export interface LegacyCustomerSnapshot {
  name: string;
  email?: string;
  tin?: string;
}

/** Presentation adapter for the existing invoice UI and browser-storage contract. */
export function toLegacyInvoice(input: {
  document: CommercialDocument;
  customer: LegacyCustomerSnapshot;
  payments: Payment[];
  allocations: PaymentAllocation[];
  asOfDate: string;
}): Invoice {
  const { document } = input;
  if (document.documentType !== "invoice" || document.currency !== "MYR") {
    throw new RangeError("The current invoice UI supports MYR standard invoices only.");
  }
  const paymentState = deriveDocumentPaymentState({
    documentId: document.id,
    payableAmount: document.monetaryTotals.payableAmount,
    dueDate: document.paymentInstructions?.dueDate,
    allocations: input.allocations,
    payments: input.payments,
    asOfDate: isoDateSchema.parse(input.asOfDate),
  });
  const status: Invoice["status"] = ["cancelled", "invalid", "rejected"].includes(document.status)
    ? "void"
    : document.status === "draft"
      ? "draft"
      : paymentState.settlementStatus === "paid"
        ? "paid"
        : paymentState.settlementStatus === "partially_paid"
          ? "partially_paid"
          : "sent";

  return {
    id: document.id,
    businessId: document.businessId,
    customerId: document.buyerPartyId,
    invoiceNumber: document.internalDocumentNumber,
    customerName: input.customer.name,
    customerEmail: input.customer.email ?? null,
    buyerTin: input.customer.tin ?? null,
    issueDate: document.issueDate,
    dueDate: document.paymentInstructions?.dueDate ?? document.issueDate,
    status,
    currency: "MYR",
    items: document.lines.map((line) => ({
      id: line.id,
      description: line.description,
      quantity: Number(line.quantity),
      unitPrice: moneyToDisplayNumber(line.unitPrice),
      taxRate: Number(line.taxTreatment.taxRate),
      classificationCode: line.classificationCode,
      unitCode: line.unitCode,
      taxTypeCode: line.taxTreatment.taxTypeCode,
      exemptionReason: line.taxTreatment.exemption?.reason,
      discountAmount: line.allowances.reduce((sum, adjustment) => sum + moneyToDisplayNumber(adjustment.amount), 0),
      chargeAmount: line.charges.reduce((sum, adjustment) => sum + moneyToDisplayNumber(adjustment.amount), 0),
    })),
    subtotal: moneyToDisplayNumber(document.monetaryTotals.lineExtensionAmount),
    tax: moneyToDisplayNumber(document.monetaryTotals.taxTotal),
    total: moneyToDisplayNumber(document.monetaryTotals.taxInclusiveAmount),
    amountPaid: moneyToDisplayNumber(paymentState.allocatedAmount),
    notes: document.notes.join("\n") || null,
    paymentTerms: document.paymentInstructions?.paymentTerms ?? null,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}
