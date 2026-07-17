import type { Transaction } from "@/types";

/** Named ranges the voice agent may ask for. Explicit ISO ranges are also supported. */
export type FinancePeriodKey =
  | "today"
  | "yesterday"
  | "this_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "all";

export interface FinancePeriod {
  label: string;
  start: string | null; // inclusive ISO date; null means unbounded (all time)
  end: string | null; // inclusive ISO date
}

export interface FinancialSummary {
  period: FinancePeriod;
  income: number;
  expenses: number;
  estimatedProfit: number;
  transactionCount: number;
  topExpenseCategories: readonly [string, number][];
}

const KL_TIME_ZONE = "Asia/Kuala_Lumpur";

/** Returns today's date in Asia/Kuala_Lumpur as YYYY-MM-DD, mirroring the transcribe route. */
export function kualaLumpurToday(now = new Date(), timeZone = KL_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** The normalized payment methods the app stores, matching `paymentMethodSchema`. */
export type NormalizedPaymentMethod = "cash" | "bank_transfer" | "card" | "ewallet" | "credit" | "unknown";

/**
 * Splits a spoken amount into subtotal/tax/total. All voice tax arithmetic lives
 * here (never delegated to the model) so rounding is deterministic and testable.
 * - `inclusive`: the amount already contains tax (RM106 including 6%).
 * - otherwise: tax is added on top (RM100 + 6% = RM106).
 * Tax is derived from the rounded subtotal so the three values always reconcile.
 */
export function computeTransactionTotals(
  amount: number,
  taxRate: number,
  inclusive: boolean,
): { subtotal: number; tax: number; total: number } {
  const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const safeRate = Number.isFinite(taxRate) && taxRate > 0 ? taxRate : 0;
  if (safeRate === 0) {
    const value = money(safeAmount);
    return { subtotal: value, tax: 0, total: value };
  }
  if (inclusive) {
    const total = money(safeAmount);
    const subtotal = money(safeAmount / (1 + safeRate / 100));
    return { subtotal, tax: money(total - subtotal), total };
  }
  const subtotal = money(safeAmount);
  const tax = money(subtotal * (safeRate / 100));
  return { subtotal, tax, total: money(subtotal + tax) };
}

// Ordered so more specific phrases win (e.g. "credit card" resolves to card, not credit).
const PAYMENT_METHOD_ALIASES: readonly [NormalizedPaymentMethod, RegExp][] = [
  ["cash", /\b(cash|tunai|kontan)\b/i],
  ["card", /\b(credit\s*card|debit\s*card|visa|master\s*card|mastercard|amex|kad)\b/i],
  ["bank_transfer", /\b(bank\s*transfer|transfer|online\s*banking|internet\s*banking|duitnow|fpx|giro|deposit|ibg)\b/i],
  ["ewallet", /\b(e-?wallet|wallet|tng|touch\s*'?n?\s*go|touchngo|grab\s*pay|grabpay|boost|shopee\s*pay|shopeepay|qr\s*pay|qr)\b/i],
  ["credit", /\b(credit|hutang|berhutang|owe|owing|install?ment|instal?men)\b/i],
  ["card", /\bcard\b/i],
];

/**
 * Maps a spoken payment method (English or common Malay/Manglish) to the stored
 * `paymentMethodSchema` enum. Unknown input resolves to "unknown" rather than
 * guessing, so the owner can still see and correct it in review.
 */
export function normalizePaymentMethod(text: string | null | undefined): NormalizedPaymentMethod {
  if (!text) return "unknown";
  const value = text.trim().toLowerCase();
  if (!value) return "unknown";
  if (value === "cash" || value === "bank_transfer" || value === "card" || value === "ewallet" || value === "credit") {
    return value;
  }
  for (const [method, pattern] of PAYMENT_METHOD_ALIASES) {
    if (pattern.test(value)) return method;
  }
  return "unknown";
}

/** Resolves a named period to inclusive ISO bounds, anchored to the KL calendar. */
export function resolveFinancePeriod(key: FinancePeriodKey, now = new Date()): FinancePeriod {
  const today = kualaLumpurToday(now);
  const [year, month] = today.split("-").map(Number);
  switch (key) {
    case "today":
      return { label: "today", start: today, end: today };
    case "yesterday": {
      const yesterday = addDays(today, -1);
      return { label: "yesterday", start: yesterday, end: yesterday };
    }
    case "this_week": {
      // ISO week starting Monday.
      const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
      return { label: "this week", start: addDays(today, -weekday), end: today };
    }
    case "this_month": {
      const start = `${year}-${String(month).padStart(2, "0")}-01`;
      return { label: "this month", start, end: today };
    }
    case "last_month": {
      const lastMonth = month === 1 ? 12 : month - 1;
      const lastMonthYear = month === 1 ? year - 1 : year;
      const start = `${lastMonthYear}-${String(lastMonth).padStart(2, "0")}-01`;
      const end = addDays(`${year}-${String(month).padStart(2, "0")}-01`, -1);
      return { label: "last month", start, end };
    }
    case "this_year":
      return { label: "this year", start: `${year}-01-01`, end: today };
    case "all":
    default:
      return { label: "all time", start: null, end: null };
  }
}

function withinPeriod(date: string, period: FinancePeriod): boolean {
  if (!date) return false;
  if (period.start && date < period.start) return false;
  if (period.end && date > period.end) return false;
  return true;
}

/**
 * Pure financial roll-up over the app's `Transaction` records. All arithmetic
 * stays here (never delegated to the model) so amounts and rounding are testable.
 * Only `confirmed` records count toward reported figures.
 */
export function summarizeTransactions(
  transactions: readonly Transaction[],
  period: FinancePeriod,
): FinancialSummary {
  const included = transactions.filter(
    (transaction) => transaction.status === "confirmed" && withinPeriod(transaction.date, period),
  );
  let income = 0;
  let expenses = 0;
  const categories = new Map<string, number>();
  for (const transaction of included) {
    if (transaction.type === "income") {
      income += transaction.total;
    } else {
      expenses += transaction.total;
      const category = transaction.category?.trim() || "Uncategorised";
      categories.set(category, (categories.get(category) ?? 0) + transaction.total);
    }
  }
  const topExpenseCategories = [...categories.entries()]
    .map(([name, total]) => [name, money(total)] as [string, number])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  return {
    period,
    income: money(income),
    expenses: money(expenses),
    estimatedProfit: money(income - expenses),
    transactionCount: included.length,
    topExpenseCategories,
  };
}

/**
 * Ranks saved transactions against a spoken query (description, category,
 * counterparty, or an amount). Pure and deterministic so the "manage records"
 * tools can be unit-tested. Falls back to most-recent-first for an empty query.
 */
export function searchTransactions(
  transactions: readonly Transaction[],
  query: string,
  limit = 5,
): Transaction[] {
  const byDateDesc = (a: Transaction, b: Transaction) => b.date.localeCompare(a.date);
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [...transactions].sort(byDateDesc).slice(0, limit);
  const amountToken = Number(normalized.replace(/[^0-9.]/g, ""));
  const tokens = normalized.split(/\s+/).filter(Boolean);
  return transactions
    .map((transaction) => {
      const haystack = `${transaction.description} ${transaction.category} ${transaction.counterpartyName}`.toLowerCase();
      let score = 0;
      for (const token of tokens) {
        if (token.length >= 2 && haystack.includes(token)) score += 10;
      }
      if (Number.isFinite(amountToken) && amountToken > 0 && Math.abs(transaction.total - amountToken) < 0.005) score += 25;
      return { transaction, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || byDateDesc(a.transaction, b.transaction))
    .slice(0, limit)
    .map((entry) => entry.transaction);
}

/** An invoice-derived outstanding balance ("who owes me"), computed in the browser. */
export interface OutstandingBalance {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string | null;
  outstanding: number;
  dueDate: string;
  overdue: boolean;
}

export function outstandingBalances(
  invoices: readonly {
    id?: string;
    invoiceNumber: string;
    customerName: string;
    customerEmail?: string | null;
    status: string;
    total: number;
    amountPaid: number;
    dueDate: string;
  }[],
  today: string,
): OutstandingBalance[] {
  return invoices
    .filter((invoice) => invoice.status !== "void" && invoice.status !== "draft")
    .map((invoice) => ({
      invoiceId: invoice.id ?? "",
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customerName,
      customerEmail: invoice.customerEmail ?? null,
      outstanding: money(invoice.total - invoice.amountPaid),
      dueDate: invoice.dueDate,
      overdue: invoice.status !== "paid" && Boolean(invoice.dueDate && invoice.dueDate < today),
    }))
    .filter((balance) => balance.outstanding > 0.005)
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.dueDate.localeCompare(b.dueDate))
    .slice(0, 30);
}
