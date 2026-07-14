import type { Transaction, TransactionLineItem, TransactionSourceType, TransactionStatus, TransactionType } from "@/types";

export const TRANSACTIONS_STORAGE_KEY = "niagaai_transactions";

const transactionTypes = new Set(["income", "expense"]);
const transactionSources = new Set<TransactionSourceType>(["receipt", "voice", "manual", "csv", "bank_statement", "whatsapp"]);
const transactionStatuses = new Set<TransactionStatus>(["draft", "needs_review", "confirmed", "failed"]);
const LEGACY_BUSINESS_ID = "business_demo";
const LEGACY_USER_ID = "user_demo";

function parseLineItem(value: unknown): TransactionLineItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (!(typeof item.id === "string" && typeof item.description === "string" &&
    typeof item.quantity === "number" && Number.isFinite(item.quantity) &&
    typeof item.unitPrice === "number" && Number.isFinite(item.unitPrice) &&
    typeof item.taxRate === "number" && Number.isFinite(item.taxRate) &&
    typeof item.subtotal === "number" && Number.isFinite(item.subtotal) &&
    typeof item.tax === "number" && Number.isFinite(item.tax) &&
    typeof item.total === "number" && Number.isFinite(item.total))) return null;
  return {
    id: item.id, description: item.description, quantity: item.quantity, unitPrice: item.unitPrice,
    taxRate: item.taxRate, subtotal: item.subtotal, tax: item.tax, total: item.total,
  };
}

function migrateTransaction(value: unknown): Transaction | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const type = String(item.type) as TransactionType;
  const sourceType = String(item.sourceType ?? item.source) as TransactionSourceType;
  const legacyStatus = String(item.status);
  const status = legacyStatus === "reviewed" ? "confirmed" : legacyStatus === "processing" ? "draft" : legacyStatus as TransactionStatus;
  const total = item.total ?? item.amount;
  const items = Array.isArray(item.items) ? item.items.map(parseLineItem) : [];
  if (items.some((lineItem) => lineItem === null)) return null;
  if (!(
    typeof item.id === "string" &&
    transactionTypes.has(type) &&
    typeof total === "number" &&
    Number.isFinite(total) &&
    typeof item.date === "string" &&
    typeof item.category === "string" &&
    typeof item.description === "string" &&
    transactionSources.has(sourceType) &&
    transactionStatuses.has(status) &&
    typeof item.createdAt === "string"
  )) return null;

  return {
    id: item.id,
    businessId: typeof item.businessId === "string" ? item.businessId : LEGACY_BUSINESS_ID,
    createdBy: typeof item.createdBy === "string" ? item.createdBy : LEGACY_USER_ID,
    type,
    status,
    sourceType,
    sourceDocumentId: typeof item.sourceDocumentId === "string" ? item.sourceDocumentId : null,
    date: item.date,
    counterpartyId: typeof item.counterpartyId === "string" ? item.counterpartyId : null,
    counterpartyName: typeof item.counterpartyName === "string" ? item.counterpartyName : typeof item.customerName === "string" ? item.customerName : typeof item.merchantName === "string" ? item.merchantName : "",
    description: item.description,
    category: item.category,
    currency: "MYR",
    subtotal: typeof item.subtotal === "number" ? item.subtotal : total,
    tax: typeof item.tax === "number" ? item.tax : 0,
    total,
    paymentMethod: typeof item.paymentMethod === "string" ? item.paymentMethod : null,
    confidenceScore: typeof item.confidenceScore === "number" ? item.confidenceScore : null,
    notes: typeof item.notes === "string" ? item.notes : null,
    items: items.filter((lineItem): lineItem is TransactionLineItem => lineItem !== null),
    createdAt: item.createdAt,
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : item.createdAt,
  };
}

function getStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function writeTransactions(transactions: Transaction[]): boolean {
  const storage = getStorage();
  if (!storage) return false;

  try {
    storage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(transactions));
    return true;
  } catch {
    return false;
  }
}

export function initializeTransactions(fallback: Transaction[]): Transaction[] {
  const storage = getStorage();
  if (!storage) return fallback;

  try {
    if (storage.getItem(TRANSACTIONS_STORAGE_KEY) !== null) return getTransactions();
    return writeTransactions(fallback) ? fallback : [];
  } catch {
    return [];
  }
}

export function getTransactions(): Transaction[] {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(TRANSACTIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const seen = new Set<string>();
    return parsed.reduce<Transaction[]>((transactions, item) => {
      const transaction = migrateTransaction(item);
      if (!transaction || seen.has(transaction.id)) return transactions;
      seen.add(transaction.id);
      transactions.push(transaction);
      return transactions;
    }, []);
  } catch {
    return [];
  }
}

export function getTransactionById(id: string): Transaction | undefined {
  return getTransactions().find((transaction) => transaction.id === id);
}

export function saveTransaction(transaction: Transaction): boolean {
  const transactions = getTransactions();
  const existingIndex = transactions.findIndex((item) => item.id === transaction.id);

  if (existingIndex >= 0) transactions[existingIndex] = transaction;
  else transactions.unshift(transaction);

  return writeTransactions(transactions);
}

export function updateTransaction(transaction: Transaction): boolean {
  return saveTransaction(transaction);
}

export function deleteTransaction(id: string): boolean {
  return writeTransactions(getTransactions().filter((transaction) => transaction.id !== id));
}

export function clearTransactions(): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.removeItem(TRANSACTIONS_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function makeTransactionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `txn_${crypto.randomUUID()}`;
  }
  return `txn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
