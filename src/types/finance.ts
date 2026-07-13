export type TransactionType = "income" | "expense";

export type TransactionSource =
  | "receipt"
  | "voice"
  | "manual"
  | "csv"
  | "bank_statement"
  | "whatsapp";

export type TransactionStatus = "processing" | "needs_review" | "reviewed";

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  date: string;
  category: string;
  description: string;
  merchantName?: string;
  customerName?: string;
  paymentMethod?: string;
  source: TransactionSource;
  status: TransactionStatus;
  createdAt: string;
}

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail?: string;
  buyerTin?: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  notes?: string;
  paymentTerms?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceReminder {
  invoiceId: string;
  remindedAt: string;
}
