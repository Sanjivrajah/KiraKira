import type { TransactionExtraction } from "@/features/transaction-agent/transaction.schema";
import { normalizeMissingFields } from "@/features/transaction-agent/clarification";
import { confirmedTransactionSchema, transactionDraftSchema, type ConfirmedTransaction, type TransactionDraft } from "@/features/transaction-agent/transaction-record.schema";
import type { DraftRepository, TransactionRepository } from "@/features/transaction-agent/transaction-repositories";
import { DUPLICATE_LOOKBACK_COUNT } from "@/features/transaction-agent/agent-config";
import { findLikelyDuplicate, isLikelyDuplicate } from "@/features/transaction-agent/duplicate-detector";
import { UNDO_WINDOW_MS } from "@/features/transaction-agent/agent-config";

export type DraftAction = "confirm" | "correct" | "cancel" | "save_anyway";
export type DraftActionResult =
  | { outcome: "confirmed"; transaction: ConfirmedTransaction }
  | { outcome: "duplicate"; draft: TransactionDraft; transaction: ConfirmedTransaction }
  | { outcome: "correct"; draft: TransactionDraft }
  | { outcome: "cancelled" }
  | { outcome: "missing" | "not_owner" | "expired" }
  | { outcome: "incomplete"; missingFields: string[] };

export type UndoResult = "voided" | "expired" | "already_voided" | "not_owner" | "missing";

const missingLabels: Record<string, string> = { type: "transaction type", amount: "amount", description: "description", purpose: "description/purpose", transactionDate: "transaction date", paymentMethod: "payment method", merchantOrCustomer: "merchant or customer" };

export function getConfirmationMissingFields(draft: TransactionExtraction): string[] {
  const parsed = normalizeMissingFields(draft);
  const missing = new Set(parsed.missingFields);
  if (parsed.type === "unknown") missing.add("type");
  if (parsed.amount === null || parsed.amount <= 0) missing.add("amount");
  if (!parsed.description.trim()) missing.add("description");
  if (!parsed.transactionDate) missing.add("transactionDate");
  if (parsed.paymentMethod === "unknown") missing.add("paymentMethod");
  return [...missing].map((field) => missingLabels[field] ?? field);
}

export class TransactionDraftService {
  private readonly actionQueues = new Map<string, Promise<void>>();

  constructor(private readonly drafts: DraftRepository, private readonly transactions: TransactionRepository, private readonly now: () => Date = () => new Date()) {}

  async createDraft(input: { extraction: TransactionExtraction; telegramUserId: string; telegramChatId: string; originalInput: string; sourceType?: TransactionDraft["sourceType"]; transcript?: string; telegramFileId?: string; id?: string }): Promise<TransactionDraft> {
    await Promise.all([this.drafts.ensure(), this.transactions.ensure()]);
    const timestamp = this.now().toISOString();
    return this.drafts.create(transactionDraftSchema.parse({ ...normalizeMissingFields(input.extraction), id: input.id ?? crypto.randomUUID(), telegramUserId: input.telegramUserId, telegramChatId: input.telegramChatId, sourceType: input.sourceType ?? "telegram_text", originalInput: input.originalInput, ...(input.transcript ? { transcript: input.transcript } : {}), ...(input.telegramFileId ? { telegramFileId: input.telegramFileId } : {}), status: "pending", createdAt: timestamp, updatedAt: timestamp }));
  }

  async act({ action, draftId, telegramUserId }: { action: DraftAction; draftId: string; telegramUserId: string }): Promise<DraftActionResult> {
    return this.withDraftLock(draftId, () => this.actOnce({ action, draftId, telegramUserId }));
  }

  async undo({ transactionId, telegramUserId, telegramChatId }: { transactionId: string; telegramUserId: string; telegramChatId: string }): Promise<UndoResult> {
    return this.withDraftLock(transactionId, async () => {
      const transaction = await this.transactions.findById(transactionId);
      if (!transaction) return "missing";
      if (transaction.telegramUserId !== telegramUserId || transaction.telegramChatId !== telegramChatId) return "not_owner";
      if (transaction.status === "voided") return "already_voided";
      if (this.now().getTime() - new Date(transaction.confirmedAt).getTime() > UNDO_WINDOW_MS) return "expired";
      const voidedAt = this.now().toISOString();
      await this.transactions.update({ ...transaction, status: "voided", voidedAt, updatedAt: voidedAt });
      return "voided";
    });
  }

  private async actOnce({ action, draftId, telegramUserId }: { action: DraftAction; draftId: string; telegramUserId: string }): Promise<DraftActionResult> {
    const draft = await this.drafts.findById(draftId);
    if (!draft) return { outcome: "missing" };
    if (draft.telegramUserId !== telegramUserId) return { outcome: "not_owner" };
    if (draft.status !== "pending") return { outcome: "expired" };
    if (action === "confirm") {
      const missingFields = getConfirmationMissingFields(draft);
      if (missingFields.length) return { outcome: "incomplete", missingFields };
      const recentTransactions = await this.transactions.findRecentByUser(telegramUserId, DUPLICATE_LOOKBACK_COUNT);
      const duplicate = findLikelyDuplicate(draft, recentTransactions.filter((transaction) => transaction.id !== draft.id));
      if (duplicate) return { outcome: "duplicate", draft, transaction: duplicate };
      return this.confirm(draft);
    }
    if (action === "correct") return { outcome: "correct", draft };
    if (action === "save_anyway") {
      // Re-load the candidate at the second confirmation; it may have changed since the warning.
      const candidate = findLikelyDuplicate(draft, await this.transactions.findRecentByUser(telegramUserId, DUPLICATE_LOOKBACK_COUNT));
      if (!candidate || !isLikelyDuplicate(draft, candidate)) return { outcome: "expired" };
      return this.confirm(draft);
    }
    await this.drafts.update({ ...draft, status: "cancelled", updatedAt: this.now().toISOString() });
    return { outcome: "cancelled" };
  }

  private async confirm(draft: TransactionDraft): Promise<DraftActionResult> {
    const confirmedAt = this.now().toISOString();
    const transaction = confirmedTransactionSchema.parse({ ...draft, status: "confirmed", confirmedAt, updatedAt: confirmedAt });
    const persistedTransaction = await this.transactions.create(transaction);
    await this.drafts.update({ ...draft, status: "confirmed", updatedAt: persistedTransaction.confirmedAt });
    return { outcome: "confirmed", transaction: persistedTransaction };
  }

  private async withDraftLock<T>(draftId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.actionQueues.get(draftId) ?? Promise.resolve();
    let release!: () => void;
    const currentTurn = new Promise<void>((resolve) => { release = resolve; });
    const tail = previous.then(() => currentTurn);
    this.actionQueues.set(draftId, tail);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.actionQueues.get(draftId) === tail) this.actionQueues.delete(draftId);
    }
  }
}
