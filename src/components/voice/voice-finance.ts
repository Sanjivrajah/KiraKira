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

const money = (value: number) => Math.round(value * 100) / 100;

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

/** An invoice-derived outstanding balance ("who owes me"), computed in the browser. */
export interface OutstandingBalance {
  invoiceNumber: string;
  customerName: string;
  outstanding: number;
  dueDate: string;
  overdue: boolean;
}

export function outstandingBalances(
  invoices: readonly {
    invoiceNumber: string;
    customerName: string;
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
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customerName,
      outstanding: money(invoice.total - invoice.amountPaid),
      dueDate: invoice.dueDate,
      overdue: invoice.status !== "paid" && Boolean(invoice.dueDate && invoice.dueDate < today),
    }))
    .filter((balance) => balance.outstanding > 0.005)
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.dueDate.localeCompare(b.dueDate))
    .slice(0, 30);
}
