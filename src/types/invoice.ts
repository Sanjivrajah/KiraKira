import type { AuditableEntity, CurrencyCode, EntityId, ISODateString, MoneyAmount } from "./common";

export type InvoiceStatus = "draft" | "sent" | "partially_paid" | "paid" | "void";
export type EffectiveInvoiceStatus = InvoiceStatus | "overdue";

export interface InvoiceLineItem {
  id: EntityId;
  description: string;
  quantity: number;
  unitPrice: MoneyAmount;
  taxRate: number;
}

export interface Invoice extends AuditableEntity {
  businessId: EntityId;
  customerId?: EntityId | null;
  invoiceNumber: string;
  customerName: string;
  customerEmail?: string | null;
  buyerTin?: string | null;
  issueDate: ISODateString;
  dueDate: ISODateString;
  status: InvoiceStatus;
  currency: CurrencyCode;
  items: InvoiceLineItem[];
  subtotal: MoneyAmount;
  tax: MoneyAmount;
  total: MoneyAmount;
  amountPaid: MoneyAmount;
  notes?: string | null;
  paymentTerms?: string | null;
}
