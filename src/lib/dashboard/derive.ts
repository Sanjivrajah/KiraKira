import { DEMO_CASH_FLOW_WINDOW_MONTHS, LOAN_READINESS_WEIGHTS } from "@/data/demo";
import { formatMoney } from "@/lib/format/money";
import type { Business, Invoice, Transaction } from "@/types";

export interface CashFlowPoint {
  month: string;
  monthKey: string;
  income: number;
  expenses: number;
  net: number;
}

export interface DashboardMetrics {
  revenue: number;
  expenses: number;
  profit: number;
  profitMargin: number | null;
  outstandingPayments: number;
  overdueInvoiceCount: number;
}

export type InsightTone = "warning" | "danger" | "info" | "brand";

export interface DashboardInsight {
  id: string;
  title: string;
  description: string;
  tone: InsightTone;
  href: string;
}

export interface LoanReadinessPreview {
  score: number;
  summary: string;
}

function malaysiaDateParts(referenceDate: Date) {
  const parts = new Intl.DateTimeFormat("en-MY", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Kuala_Lumpur",
  }).formatToParts(referenceDate);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function currentMonthKey(referenceDate: Date) {
  const { year, month } = malaysiaDateParts(referenceDate);
  return `${year}-${String(month).padStart(2, "0")}`;
}

function isOverdue(invoice: Invoice, todayKey: string) {
  return invoice.status === "sent" && invoice.dueDate < todayKey;
}

export function deriveDashboardMetrics(
  transactions: Transaction[],
  invoices: Invoice[],
  referenceDate: Date,
): DashboardMetrics {
  const monthKey = currentMonthKey(referenceDate);
  const current = transactions.filter((transaction) => transaction.date.startsWith(monthKey) && transaction.status !== "failed");
  const revenue = current.filter((item) => item.type === "income").reduce((sum, item) => sum + item.total, 0);
  const expenses = current.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.total, 0);
  const profit = revenue - expenses;
  const outstanding = invoices.filter((invoice) => invoice.status === "sent" || invoice.status === "partially_paid");
  const { year, month, day } = malaysiaDateParts(referenceDate);
  const todayKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return {
    revenue,
    expenses,
    profit,
    profitMargin: revenue === 0 ? null : (profit / revenue) * 100,
    outstandingPayments: outstanding.reduce((sum, invoice) => sum + Math.max(0, invoice.total - invoice.amountPaid), 0),
    overdueInvoiceCount: invoices.filter((invoice) => isOverdue(invoice, todayKey)).length,
  };
}

export function deriveCashFlow(
  transactions: Transaction[],
  referenceDate: Date,
  monthCount = DEMO_CASH_FLOW_WINDOW_MONTHS,
): CashFlowPoint[] {
  const { year, month } = malaysiaDateParts(referenceDate);
  return Array.from({ length: monthCount }, (_, index) => {
    const date = new Date(Date.UTC(year, month - monthCount + index, 1));
    const pointYear = date.getUTCFullYear();
    const pointMonth = date.getUTCMonth() + 1;
    const monthKey = `${pointYear}-${String(pointMonth).padStart(2, "0")}`;
    const records = transactions.filter((transaction) => transaction.date.startsWith(monthKey) && transaction.status !== "failed");
    const income = records.filter((item) => item.type === "income").reduce((sum, item) => sum + item.total, 0);
    const expenses = records.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.total, 0);
    return {
      month: new Intl.DateTimeFormat("en-MY", { month: "short", timeZone: "UTC" }).format(date),
      monthKey,
      income,
      expenses,
      net: income - expenses,
    };
  });
}

export function deriveDashboardInsights({
  metrics,
  reviewCount,
  business,
  cashFlow,
}: {
  metrics: DashboardMetrics;
  reviewCount: number;
  business: Business | null;
  cashFlow: CashFlowPoint[];
}): DashboardInsight[] {
  const insights: DashboardInsight[] = [];
  if (reviewCount > 0) {
    insights.push({
      id: "review",
      title: `${reviewCount} transaction${reviewCount === 1 ? "" : "s"} need review`,
      description: "Confirm the details before relying on them in your records.",
      tone: "warning",
      href: "/transactions?status=needs_review",
    });
  }
  if (metrics.overdueInvoiceCount > 0) {
    insights.push({
      id: "overdue",
      title: `${metrics.overdueInvoiceCount} invoice${metrics.overdueInvoiceCount === 1 ? " is" : "s are"} overdue`,
      description: `${formatMoney(metrics.outstandingPayments)} is still waiting to be collected across open invoices.`,
      tone: "danger",
      href: "/reminders",
    });
  }
  if (business && (!business.registrationNumber || !business.tin)) {
    const missing = [!business.registrationNumber && "registration number", !business.tin && "tax identification number"].filter(Boolean).join(" and ");
    insights.push({
      id: "profile",
      title: "Business profile needs a little more detail",
      description: `Add your ${missing} when available to improve record completeness.`,
      tone: "brand",
      href: "/settings",
    });
  }
  const latest = cashFlow.at(-1);
  if (latest && latest.net < 0) {
    insights.push({
      id: "cash",
      title: "Expenses are above income this month",
      description: `${formatMoney(Math.abs(latest.net))} more went out than came in from current local records.`,
      tone: "info",
      href: "/cash-flow",
    });
  }
  if (insights.length === 0) {
    insights.push({
      id: "clear",
      title: "Your local records look up to date",
      description: "There are no overdue invoices or transactions waiting for review.",
      tone: "brand",
      href: "/transactions",
    });
  }
  return insights;
}

export function deriveLoanReadiness({
  transactions,
  invoices,
  metrics,
  reviewCount,
  business,
}: {
  transactions: Transaction[];
  invoices: Invoice[];
  metrics: DashboardMetrics;
  reviewCount: number;
  business: Business | null;
}): LoanReadinessPreview {
  let score = LOAN_READINESS_WEIGHTS.startingScore;
  if (transactions.length >= 3) score += LOAN_READINESS_WEIGHTS.transactionHistory;
  if (transactions.some((item) => item.type === "income") && transactions.some((item) => item.type === "expense")) score += LOAN_READINESS_WEIGHTS.incomeAndExpenses;
  if (transactions.length > 0 && reviewCount === 0) score += LOAN_READINESS_WEIGHTS.reviewedRecords;
  if (invoices.length > 0) score += LOAN_READINESS_WEIGHTS.invoiceHistory;
  if (invoices.length > 0 && metrics.overdueInvoiceCount === 0) score += LOAN_READINESS_WEIGHTS.noOverdueInvoices;
  if (business?.registrationNumber) score += LOAN_READINESS_WEIGHTS.registrationNumber;
  if (business?.tin) score += LOAN_READINESS_WEIGHTS.taxIdentificationNumber;
  const summary = reviewCount > 0
    ? `Review ${reviewCount} transaction${reviewCount === 1 ? "" : "s"} to make your local records more complete.`
    : metrics.overdueInvoiceCount > 0
      ? "Following up on overdue invoices may improve the completeness of your cash records."
      : "Your current local records cover several useful financing-preparation basics.";
  return { score: Math.min(100, score), summary };
}
