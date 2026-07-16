import type { ConfirmedTransaction } from "@/features/transaction-agent/transaction-record.schema";
import { confirmedTransactionSchema } from "@/features/transaction-agent/transaction-record.schema";
import type { TransactionRepository } from "@/features/transaction-agent/transaction-repositories";
import { calculateTransactionSummary } from "@/features/transaction-agent/transaction-summary";

export type Period = { start: string; end: string };
export type TransactionCursor = `${string}|${string}`;
export const HISTORY_PAGE_SIZE = 10;
export const MAX_SEARCH_QUERY_LENGTH = 120;
export const MAX_SEARCH_RESULTS = 30;

function dateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function addDays(value: string, days: number): string { const d = new Date(`${value}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
export function periodFor(kind: "today" | "week" | "month" | "last_month", timeZone: string, now = new Date()): Period {
  const today = dateInTimeZone(now, timeZone);
  if (kind === "today") return { start: today, end: today };
  if (kind === "week") { const day = new Date(`${today}T12:00:00Z`).getUTCDay() || 7; return { start: addDays(today, 1 - day), end: today }; }
  const [year, month] = today.split("-").map(Number);
  const current = `${year}-${String(month).padStart(2, "0")}-01`;
  if (kind === "month") return { start: current, end: today };
  const previous = new Date(Date.UTC(year, month - 2, 1)); const start = previous.toISOString().slice(0, 10);
  return { start, end: addDays(current, -1) };
}
export function validatePeriod(start: string, end: string): Period | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) return null;
  return { start, end };
}
export function activeInPeriod(records: readonly ConfirmedTransaction[], period: Period): ConfirmedTransaction[] {
  return records.filter((record) => record.status === "confirmed" && record.transactionDate !== null && record.transactionDate >= period.start && record.transactionDate <= period.end);
}
export function categoryBreakdown(records: readonly ConfirmedTransaction[]) {
  return [...records.reduce((result, item) => { const category = item.category?.trim() || "Uncategorized"; result.set(category, (result.get(category) ?? 0) + (item.amount ?? 0)); return result; }, new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1]);
}
function cursor(record: ConfirmedTransaction): TransactionCursor { return `${record.transactionDate ?? ""}|${record.confirmedAt}`; }
export function paginateTransactions(records: readonly ConfirmedTransaction[], after?: string, size = HISTORY_PAGE_SIZE) {
  const sorted = records.filter((record) => record.status === "confirmed").sort((a, b) => cursor(b).localeCompare(cursor(a)) || b.id.localeCompare(a.id));
  const index = after ? sorted.findIndex((record) => cursor(record) === after) + 1 : 0;
  const items = sorted.slice(Math.max(index, 0), Math.max(index, 0) + size);
  return { items, nextCursor: items.length === size ? cursor(items.at(-1)!) : null };
}
const normalise = (value: string) => value.normalize("NFKD").toLocaleLowerCase().replace(/\p{Diacritic}/gu, "").trim();
export function searchTransactions(records: readonly ConfirmedTransaction[], query: string): ConfirmedTransaction[] {
  const needle = normalise(query); if (!needle || needle.length > MAX_SEARCH_QUERY_LENGTH) return [];
  const amount = /^rm?\s*([0-9]+(?:\.[0-9]{1,2})?)$/i.exec(needle)?.[1];
  return records.filter((record) => record.status === "confirmed" && (amount ? record.amount === Number(amount) : [record.description, record.merchantOrCustomer ?? "", record.category ?? ""].some((value) => normalise(value).includes(needle)))).slice(0, MAX_SEARCH_RESULTS);
}
export function summaryForPeriod(records: readonly ConfirmedTransaction[], period: Period) { const included = activeInPeriod(records, period); return { period, ...calculateTransactionSummary(included), categories: categoryBreakdown(included) }; }
export function escapeCsvCell(value: string | number | null): string { const raw = value === null ? "" : String(value); const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw; return `"${safe.replaceAll('"', '""')}"`; }
export function transactionsToCsv(records: readonly ConfirmedTransaction[]): string {
  const headers = ["id", "date", "type", "amount_myr", "description", "merchant_or_customer", "category", "payment_method", "confirmed_at"];
  return [headers.join(","), ...records.map((item) => [item.id, item.transactionDate, item.type, item.amount, item.description, item.merchantOrCustomer, item.category, item.paymentMethod, item.confirmedAt].map(escapeCsvCell).join(","))].join("\n");
}

type EditableField = "amount" | "description" | "merchantOrCustomer" | "transactionDate" | "paymentMethod" | "type" | "category";
export class DailyBookkeepingService {
  constructor(private readonly transactions: TransactionRepository, private readonly now: () => Date = () => new Date()) {}
  async amend(input: { transactionId: string; telegramUserId: string; telegramChatId: string; changes: Partial<Pick<ConfirmedTransaction, EditableField>>; reason?: string | null }): Promise<"missing" | "not_owner" | "voided" | ConfirmedTransaction> {
    const current = await this.transactions.findById(input.transactionId);
    if (!current) return "missing";
    if (current.telegramUserId !== input.telegramUserId || current.telegramChatId !== input.telegramChatId) return "not_owner";
    if (current.status === "voided") return "voided";
    const changedFields = (Object.keys(input.changes) as EditableField[]).filter((field) => input.changes[field] !== undefined && input.changes[field] !== current[field]);
    if (!changedFields.length) return current;
    const previousSnapshot = { type: current.type, amount: current.amount, description: current.description, merchantOrCustomer: current.merchantOrCustomer, transactionDate: current.transactionDate, paymentMethod: current.paymentMethod, category: current.category, confidence: current.confidence, missingFields: [] };
    const nextSnapshot = { ...previousSnapshot, ...input.changes };
    const timestamp = this.now().toISOString();
    const next = confirmedTransactionSchema.parse({ ...current, ...input.changes, schemaVersion: 2, originalConfirmedSnapshot: current.originalConfirmedSnapshot ?? previousSnapshot, amendments: [...(current.amendments ?? []), { id: crypto.randomUUID(), changedFields, previousSnapshot, nextSnapshot, reason: input.reason?.trim() || null, createdAt: timestamp }], updatedAt: timestamp });
    return this.transactions.update(next);
  }
  async void(input: { transactionId: string; telegramUserId: string; telegramChatId: string; reason: string }): Promise<"missing" | "not_owner" | "already_voided" | ConfirmedTransaction> {
    const current = await this.transactions.findById(input.transactionId);
    if (!current) return "missing";
    if (current.telegramUserId !== input.telegramUserId || current.telegramChatId !== input.telegramChatId) return "not_owner";
    if (current.status === "voided") return "already_voided";
    const timestamp = this.now().toISOString();
    return this.transactions.update(confirmedTransactionSchema.parse({ ...current, status: "voided", voidedAt: timestamp, voidReason: input.reason.trim().slice(0, 280) || "Owner requested void", updatedAt: timestamp }));
  }
}
