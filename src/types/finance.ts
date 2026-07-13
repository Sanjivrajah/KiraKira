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
