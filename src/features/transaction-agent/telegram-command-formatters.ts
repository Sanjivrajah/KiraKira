import { TELEGRAM_MESSAGE_LIMIT } from "@/features/transaction-agent/agent-config";
import { calculateTransactionSummary } from "@/features/transaction-agent/transaction-summary";
import type { ConfirmedTransaction } from "@/features/transaction-agent/transaction-record.schema";
import type { BotLocale } from "@/bot/messages";

export function formatMyr(amount: number): string {
  return new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

function displayType(type: ConfirmedTransaction["type"], locale: BotLocale): string {
  if (locale === "ms") return ({ income: "Wang masuk", expense: "Wang keluar", customer_payment: "Bayaran pelanggan", unknown: "Tidak diketahui" } as const)[type];
  return type === "customer_payment" ? "Customer payment" : `${type.slice(0, 1).toUpperCase()}${type.slice(1)}`;
}

function displayPaymentMethod(method: ConfirmedTransaction["paymentMethod"], locale: BotLocale): string {
  if (locale === "ms") return ({ cash: "Tunai", bank_transfer: "Pindahan bank", card: "Kad", ewallet: "E-wallet", credit: "Kredit", unknown: "Tidak diketahui" } as const)[method];
  return method === "bank_transfer" ? "Bank transfer" : method === "ewallet" ? "E-wallet" : method.slice(0, 1).toUpperCase() + method.slice(1);
}

function displayDate(date: string | null, locale: BotLocale): string {
  if (!date) return locale === "ms" ? "Tarikh tidak tersedia" : "Date unavailable";
  return new Intl.DateTimeFormat(locale === "ms" ? "ms-MY" : "en-MY", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kuala_Lumpur" }).format(new Date(`${date}T00:00:00+08:00`));
}

export function formatRecentTransactions(transactions: readonly ConfirmedTransaction[], totalCount = transactions.length, locale: BotLocale = "en"): string {
  if (!transactions.length) return locale === "ms" ? "Anda belum mempunyai transaksi yang disahkan. Hantar teks atau nota suara untuk mula." : "You have no confirmed transactions yet. Send a transaction as text or a voice note to get started.";
  const entries: string[] = [locale === "ms" ? "Transaksi terkini" : "Recent transactions"];
  for (const [index, transaction] of transactions.entries()) {
    entries.push(`${index + 1}. ${displayDate(transaction.transactionDate, locale)}\n${displayType(transaction.type, locale)} — ${transaction.description}${transaction.merchantOrCustomer ? `\n${transaction.merchantOrCustomer}` : ""}\n${formatMyr(transaction.amount ?? 0)} · ${displayPaymentMethod(transaction.paymentMethod, locale)}`);
  }
  entries.push(locale === "ms" ? `Menunjukkan ${transactions.length} transaksi terkini${totalCount > transactions.length ? ` daripada ${totalCount}` : ""}.` : `Showing the latest ${transactions.length} transaction${transactions.length === 1 ? "" : "s"}${totalCount > transactions.length ? ` of ${totalCount}` : ""}.`);
  return entries.join("\n\n");
}

export function formatTransactionSummary(transactions: readonly ConfirmedTransaction[], locale: BotLocale = "en"): string {
  const summary = calculateTransactionSummary(transactions);
  if (locale === "ms") return `Ringkasan transaksi NiagaAI\n\nPendapatan: ${formatMyr(summary.income)}\nBayaran pelanggan: ${formatMyr(summary.customerPayments)}\nPerbelanjaan: ${formatMyr(summary.expenses)}\nPergerakan tunai bersih: ${formatMyr(summary.netCashMovement)}\nTransaksi direkodkan: ${summary.transactionCount}\n\nIni ialah ringkasan asas, bukan penyata untung rugi yang diaudit.`;
  return `NiagaAI transaction summary\n\nIncome: ${formatMyr(summary.income)}\nCustomer payments: ${formatMyr(summary.customerPayments)}\nExpenses: ${formatMyr(summary.expenses)}\nNet cash movement: ${formatMyr(summary.netCashMovement)}\nTransactions recorded: ${summary.transactionCount}\n\nThis is a basic transaction summary and not an audited profit-and-loss statement.`;
}

/** Split only at newline boundaries, preserving every character under Telegram's message cap. */
export function splitTelegramMessage(message: string, limit = TELEGRAM_MESSAGE_LIMIT): string[] {
  if (message.length <= limit) return [message];
  const parts: string[] = [];
  let remaining = message;
  while (remaining.length > limit) {
    const boundary = remaining.lastIndexOf("\n", limit);
    const end = boundary > 0 ? boundary : limit;
    parts.push(remaining.slice(0, end));
    remaining = remaining.slice(end).replace(/^\n/, "");
  }
  parts.push(remaining);
  return parts;
}
