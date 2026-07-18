import type { MultiIntentExtraction } from "@/features/transaction-agent/multi-intent.schema";
import type { TransactionExtraction } from "@/features/transaction-agent/transaction.schema";

export type AgentLocale = "en" | "ms";

/**
 * Actionable transaction proposals from a multi-intent message, in the order the model
 * detected them. Non-transaction capabilities (receivables, unsupported) are surfaced as
 * notes rather than drafts, so nothing is silently dropped.
 */
export function splitMultiIntentTransactions(extraction: MultiIntentExtraction): TransactionExtraction[] {
  return [...extraction.actions]
    .sort((a, b) => a.actionIndex - b.actionIndex)
    .filter((action) => action.capability === "transaction_capture" && action.transaction)
    .map((action) => action.transaction as TransactionExtraction);
}

/** Short, non-sensitive lines explaining what was captured but not turned into a draft. */
export function buildMultiIntentNotes(extraction: MultiIntentExtraction, locale: AgentLocale = "en"): string[] {
  const receivables = extraction.actions.filter((action) => action.capability === "receivable_capture").length;
  const unsupported = extraction.actions.filter((action) => action.capability === "unsupported").length;
  const notes: string[] = [];
  if (receivables > 0) {
    notes.push(locale === "ms"
      ? `${receivables} baki belum terima dikesan. Rekod belum terima belum disokong lagi, jadi ia tidak disimpan.`
      : `Noted ${receivables} outstanding amount${receivables > 1 ? "s" : ""} a customer owes. Receivables aren't saved yet, so nothing was recorded for ${receivables > 1 ? "those" : "that"}.`);
  }
  if (unsupported > 0) {
    notes.push(locale === "ms"
      ? `${unsupported} permintaan lain tidak disokong dalam sesi ini.`
      : `${unsupported} other request${unsupported > 1 ? "s were" : " was"} outside what I can record here.`);
  }
  return notes;
}
