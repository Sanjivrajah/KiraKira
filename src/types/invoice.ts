import type { AuditableEntity, CurrencyCode, EntityId, ISODateString, MoneyAmount } from "./common";

export type InvoiceStatus = "draft" | "sent" | "partially_paid" | "paid" | "void";
export type EffectiveInvoiceStatus = InvoiceStatus | "overdue";

export interface InvoiceLineItem {
  id: EntityId;
  description: string;
  quantity: number;
  unitPrice: MoneyAmount;
  taxRate: number;
  classificationCode?: string;
  unitCode?: string;
  taxTypeCode?: string;
  exemptionReason?: string;
  discountAmount?: number;
  chargeAmount?: number;
}

export interface Invoice extends AuditableEntity {
  businessId: EntityId;
  customerId?: EntityId | null;
  invoiceNumber: string;
  documentType?: "invoice" | "credit_note" | "debit_note" | "refund_note" | "self_billed_invoice" | "self_billed_credit_note" | "self_billed_debit_note" | "self_billed_refund_note";
  customerName: string;
  customerEmail?: string | null;
  buyerTin?: string | null;
  issueDate: ISODateString;
  issueTime?: string;
  dueDate: ISODateString;
  status: InvoiceStatus;
  currency: CurrencyCode;
  items: InvoiceLineItem[];
  subtotal: MoneyAmount;
  tax: MoneyAmount;
  total: MoneyAmount;
  prepaymentAmount?: MoneyAmount;
  amountPaid: MoneyAmount;
  notes?: string | null;
  paymentTerms?: string | null;
  paymentModeCode?: string | null;
  bankAccountIdentifier?: string | null;
  originalDocumentReference?: string | null;
}
