import type { AuditableEntity, CurrencyCode, EntityId, ISODateString, MoneyAmount } from "./common";

export type TransactionType = "income" | "expense";
export type TransactionStatus = "draft" | "needs_review" | "confirmed" | "failed";
export type TransactionSourceType = "manual" | "receipt" | "voice" | "csv" | "bank_statement" | "whatsapp";

export interface TransactionLineItem {
  id: EntityId;
  description: string;
  quantity: number;
  unitPrice: MoneyAmount;
  taxRate: number;
  subtotal: MoneyAmount;
  tax: MoneyAmount;
  total: MoneyAmount;
}

export interface Transaction extends AuditableEntity {
  businessId: EntityId;
  createdBy: EntityId;
  type: TransactionType;
  status: TransactionStatus;
  sourceType: TransactionSourceType;
  sourceDocumentId?: EntityId | null;
  date: ISODateString;
  counterpartyId?: EntityId | null;
  counterpartyName: string;
  description: string;
  category: string;
  currency: CurrencyCode;
  subtotal: MoneyAmount;
  tax: MoneyAmount;
  total: MoneyAmount;
  paymentMethod?: string | null;
  confidenceScore?: number | null;
  notes?: string | null;
  items: TransactionLineItem[];
}
