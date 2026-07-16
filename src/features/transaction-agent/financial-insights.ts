import { z } from "zod";
import type { BotLocale } from "@/bot/messages";
import { periodFor, validatePeriod, type Period } from "@/features/transaction-agent/daily-bookkeeping";
import type { Receivable } from "@/features/transaction-agent/receivables";
import type { ConfirmedTransaction } from "@/features/transaction-agent/transaction-record.schema";
import { calculateTransactionSummary } from "@/features/transaction-agent/transaction-summary";
import { formatMyr, formatRecentTransactions } from "@/features/transaction-agent/telegram-command-formatters";

const dateRangeSchema = z.object({ from: z.string().date(), to: z.string().date() }).refine(({ from, to }) => from <= to, "The start date must not be after the end date.");
export const financialInsightQuerySchema = z.object({
  kind: z.enum(["sales_expenses", "profit_summary", "outstanding_receivables", "expense_categories", "recent_transactions", "cash_comparison", "profit_vs_cash"]),
  dateRange: dateRangeSchema.optional(),
});
export type FinancialInsightQuery = z.infer<typeof financialInsightQuerySchema>;

export type FinancialInsightData = {
  period: Period;
  income: number;
  expenses: number;
  customerPayments: number;
  estimatedProfit: number;
  netCashMovement: number;
  transactionCount: number;
  categories: readonly [string, number][];
  recent: readonly ConfirmedTransaction[];
  outstandingReceivables: number | null;
};

const bounded = (records: readonly ConfirmedTransaction[], period: Period) => records
  .filter((record) => record.status === "confirmed" && record.transactionDate && record.transactionDate >= period.start && record.transactionDate <= period.end);

/** Parses a deliberately narrow, deterministic subset of insight questions; no financial arithmetic is delegated to a model. */
export function parseFinancialInsightQuery(input: string, now = new Date(), timeZone = "Asia/Kuala_Lumpur"): FinancialInsightQuery | null {
  const text = input.trim().toLocaleLowerCase();
  const dates = text.match(/(\d{4}-\d{2}-\d{2})\s+(?:to|until|hingga|sampai)\s+(\d{4}-\d{2}-\d{2})/);
  const dateRange = dates ? validatePeriod(dates[1], dates[2]) : periodFor("month", timeZone, now);
  if (!dateRange) return null;
  const kind = /profit|untung/.test(text) ? "profit_summary"
    : /receivable|outstanding|belum bayar|hutang pelanggan/.test(text) ? "outstanding_receivables"
      : /biggest expense|expense categor|kategori.*belanja/.test(text) ? "expense_categories"
        : /recent transaction|transaksi terkini/.test(text) ? "recent_transactions"
          : /cash.?in|cash.?out|tunai.*masuk|tunai.*keluar/.test(text) ? "cash_comparison"
            : /cash.*profit|profit.*cash|tunai.*untung|untung.*tunai/.test(text) ? "profit_vs_cash"
              : /sales|expense|jualan|belanja/.test(text) ? "sales_expenses" : null;
  return kind ? { kind, ...(kind === "outstanding_receivables" || kind === "recent_transactions" ? {} : { dateRange: { from: dateRange.start, to: dateRange.end } }) } : null;
}

export function calculateFinancialInsight(query: FinancialInsightQuery, transactions: readonly ConfirmedTransaction[], receivables: readonly Receivable[] | null, now = new Date(), timeZone = "Asia/Kuala_Lumpur"): FinancialInsightData {
  const parsed = financialInsightQuerySchema.parse(query);
  const period = parsed.dateRange ? { start: parsed.dateRange.from, end: parsed.dateRange.to } : periodFor("month", timeZone, now);
  const included = bounded(transactions, period);
  const summary = calculateTransactionSummary(included);
  const categories = [...included.filter((item) => item.type === "expense").reduce((totals, item) => {
    const category = item.category?.trim() || "Uncategorized";
    totals.set(category, (totals.get(category) ?? 0) + (item.amount ?? 0));
    return totals;
  }, new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1]).slice(0, 5) as [string, number][];
  return {
    period, ...summary, estimatedProfit: Math.round((summary.income - summary.expenses) * 100) / 100, categories,
    recent: transactions.filter((item) => item.status === "confirmed").sort((a, b) => `${b.transactionDate ?? ""}|${b.confirmedAt}`.localeCompare(`${a.transactionDate ?? ""}|${a.confirmedAt}`)).slice(0, 10),
    outstandingReceivables: receivables === null ? null : Math.round(receivables.filter((item) => item.status !== "voided" && item.outstandingAmount > 0).reduce((total, item) => total + item.outstandingAmount, 0) * 100) / 100,
  };
}

export function formatFinancialInsight(query: FinancialInsightQuery, data: FinancialInsightData, locale: BotLocale = "en"): string {
  const ms = locale === "ms";
  const basis = ms ? `Berdasarkan transaksi disahkan dari ${data.period.start} hingga ${data.period.end}. Anggaran daripada transaksi direkodkan, bukan penyata diaudit.` : `Based on confirmed transactions from ${data.period.start} to ${data.period.end}. Estimated from recorded transactions; not an audited statement.`;
  switch (query.kind) {
    case "sales_expenses": return `${ms ? "Jualan dan perbelanjaan" : "Sales and expenses"}\n\n${ms ? "Jualan" : "Sales"}: ${formatMyr(data.income)}\n${ms ? "Perbelanjaan" : "Expenses"}: ${formatMyr(data.expenses)}\n\n${basis}`;
    case "profit_summary": return `${ms ? "Anggaran untung" : "Estimated profit"}\n\n${ms ? "Jualan" : "Sales"}: ${formatMyr(data.income)}\n${ms ? "Perbelanjaan" : "Expenses"}: ${formatMyr(data.expenses)}\n${ms ? "Anggaran untung" : "Estimated profit"}: ${formatMyr(data.estimatedProfit)}\n\n${basis}`;
    case "outstanding_receivables": return data.outstandingReceivables === null ? (ms ? "Data hutang pelanggan belum tersedia dalam mod storan ini." : "Receivables data is not available in this storage mode yet.") : `${ms ? "Hutang pelanggan tertunggak" : "Outstanding receivables"}\n\n${formatMyr(data.outstandingReceivables)}\n\n${ms ? "Tidak termasuk rekod dibatalkan." : "Voided records are excluded."}`;
    case "expense_categories": return `${ms ? "Kategori perbelanjaan terbesar" : "Biggest expense categories"}\n\n${data.categories.length ? data.categories.map(([name, amount]) => `• ${name}: ${formatMyr(amount)}`).join("\n") : (ms ? "Tiada perbelanjaan disahkan dalam tempoh ini." : "No confirmed expenses in this period.")}\n\n${basis}`;
    case "recent_transactions": return `${formatRecentTransactions(data.recent, data.recent.length, locale)}\n\n${ms ? "Hanya transaksi disahkan dipaparkan." : "Only confirmed transactions are shown."}`;
    case "cash_comparison": return `${ms ? "Tunai masuk dan keluar" : "Cash in and cash out"}\n\n${ms ? "Tunai masuk" : "Cash in"}: ${formatMyr(data.income + data.customerPayments)}\n${ms ? "Tunai keluar" : "Cash out"}: ${formatMyr(data.expenses)}\n${ms ? "Pergerakan tunai bersih" : "Net cash movement"}: ${formatMyr(data.netCashMovement)}\n\n${basis}`;
    case "profit_vs_cash": return `${ms ? "Untung berbanding tunai" : "Profit versus cash"}\n\n${ms ? "Anggaran untung" : "Estimated profit"}: ${formatMyr(data.estimatedProfit)}\n${ms ? "Pergerakan tunai bersih" : "Net cash movement"}: ${formatMyr(data.netCashMovement)}\n\n${ms ? "Tunai termasuk bayaran pelanggan; bayaran itu bukan jualan baharu, jadi tunai dan untung boleh berbeza." : "Cash includes customer payments; those payments are not new sales, so cash and profit can differ."}\n\n${basis}`;
  }
}
