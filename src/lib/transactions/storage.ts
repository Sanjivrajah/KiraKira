import type { Transaction } from "@/types/finance";

export const TRANSACTIONS_STORAGE_KEY = "niagaai_transactions";

const transactionTypes = new Set(["income", "expense"]);
const transactionSources = new Set(["receipt", "voice", "manual", "csv", "bank_statement", "whatsapp"]);
const transactionStatuses = new Set(["processing", "needs_review", "reviewed"]);
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const isBoundedString = (value: unknown, maximum: number) => typeof value === "string" && value.length <= maximum;

function isTransaction(value: unknown): value is Transaction {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    isBoundedString(item.id, 120) &&
    transactionTypes.has(String(item.type)) &&
    typeof item.amount === "number" && Number.isFinite(item.amount) && item.amount >= 0 && item.amount <= 10_000_000 &&
    typeof item.date === "string" && isoDatePattern.test(item.date) &&
    isBoundedString(item.category, 60) &&
    isBoundedString(item.description, 160) &&
    transactionSources.has(String(item.source)) &&
    transactionStatuses.has(String(item.status)) &&
    isBoundedString(item.createdAt, 40)
  );
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
    return parsed.filter((item): item is Transaction => {
      if (!isTransaction(item) || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
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
