import type { TransactionExtraction } from "@/features/transaction-agent/transaction.schema";
import { normalizeMissingFields } from "@/features/transaction-agent/clarification";
import { confirmedTransactionSchema, transactionDraftSchema, type ConfirmedTransaction, type TransactionDraft } from "@/features/transaction-agent/transaction-record.schema";
import type { DraftRepository, TransactionRepository } from "@/features/transaction-agent/transaction-repositories";

export type DraftAction = "confirm" | "correct" | "cancel";
export type DraftActionResult =
  | { outcome: "confirmed"; transaction: ConfirmedTransaction }
  | { outcome: "correct"; draft: TransactionDraft }
  | { outcome: "cancelled" }
  | { outcome: "missing" | "not_owner" | "expired" }
  | { outcome: "incomplete"; missingFields: string[] };

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
  constructor(private readonly drafts: DraftRepository, private readonly transactions: TransactionRepository, private readonly now: () => Date = () => new Date()) {}

  async createDraft(input: { extraction: TransactionExtraction; telegramUserId: string; telegramChatId: string; originalInput: string; id?: string }): Promise<TransactionDraft> {
    await Promise.all([this.drafts.ensure(), this.transactions.ensure()]);
    const timestamp = this.now().toISOString();
    return this.drafts.create(transactionDraftSchema.parse({ ...normalizeMissingFields(input.extraction), id: input.id ?? crypto.randomUUID(), telegramUserId: input.telegramUserId, telegramChatId: input.telegramChatId, sourceType: "telegram_text", originalInput: input.originalInput, status: "pending", createdAt: timestamp, updatedAt: timestamp }));
  }

  async act({ action, draftId, telegramUserId }: { action: DraftAction; draftId: string; telegramUserId: string }): Promise<DraftActionResult> {
    const draft = await this.drafts.findById(draftId);
    if (!draft) return { outcome: "missing" };
    if (draft.telegramUserId !== telegramUserId) return { outcome: "not_owner" };
    if (draft.status !== "pending") return { outcome: "expired" };
    if (action === "confirm") {
      const missingFields = getConfirmationMissingFields(draft);
      if (missingFields.length) return { outcome: "incomplete", missingFields };
      const confirmedAt = this.now().toISOString();
      const transaction = confirmedTransactionSchema.parse({ ...draft, status: "confirmed", confirmedAt, updatedAt: confirmedAt });
      await this.transactions.create(transaction);
      await this.drafts.update({ ...draft, status: "confirmed", updatedAt: confirmedAt });
      return { outcome: "confirmed", transaction };
    }
    if (action === "correct") return { outcome: "correct", draft };
    await this.drafts.update({ ...draft, status: "cancelled", updatedAt: this.now().toISOString() });
    return { outcome: "cancelled" };
  }
}
