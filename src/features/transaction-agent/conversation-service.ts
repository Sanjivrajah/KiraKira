import { normalizeMissingFields, selectClarificationField } from "@/features/transaction-agent/clarification";
import { type ConversationState, type ConversationRequestedField } from "@/features/transaction-agent/conversation-state";
import type { ConversationStateRepository } from "@/features/transaction-agent/conversation-repository";
import type { TransactionDraft } from "@/features/transaction-agent/transaction-record.schema";
import type { TransactionExtraction } from "@/features/transaction-agent/transaction.schema";
import type { DraftRepository } from "@/features/transaction-agent/transaction-repositories";

export type ConversationUpdateResult =
  | { outcome: "updated"; draft: TransactionDraft; nextField: ConversationRequestedField | null }
  | { outcome: "missing" | "not_owner" | "expired" };

export class ConversationService {
  constructor(private readonly drafts: DraftRepository, private readonly states: ConversationStateRepository, private readonly now: () => Date = () => new Date()) {}

  async beginClarification(draft: TransactionDraft): Promise<ConversationRequestedField | null> {
    const requestedField = selectClarificationField(draft);
    if (!requestedField) return null;
    await this.states.save(this.newState(draft, "awaiting_clarification", requestedField));
    return requestedField;
  }
  async beginCorrection(draft: TransactionDraft): Promise<void> { await this.states.save(this.newState(draft, "awaiting_correction")); }
  async getActive(telegramUserId: string): Promise<ConversationState | null> { return this.states.findByUser(telegramUserId); }
  async clearByUser(telegramUserId: string): Promise<void> { await this.states.removeByUser(telegramUserId); }
  async clearByDraftId(draftId: string): Promise<void> { await this.states.removeByDraftId(draftId); }

  async replaceDraft({ state, telegramUserId, extraction }: { state: ConversationState; telegramUserId: string; extraction: TransactionExtraction }): Promise<ConversationUpdateResult> {
    const draft = await this.drafts.findById(state.draftId);
    if (!draft) { await this.states.removeByUser(telegramUserId); return { outcome: "missing" }; }
    if (draft.telegramUserId !== telegramUserId || state.telegramUserId !== telegramUserId) return { outcome: "not_owner" };
    if (draft.status !== "pending") { await this.states.removeByUser(telegramUserId); return { outcome: "expired" }; }
    const updatedAt = this.now().toISOString();
    const normalizedExtraction = normalizeMissingFields(extraction);
    const updated = await this.drafts.update({ ...draft, ...normalizedExtraction, id: draft.id, telegramUserId: draft.telegramUserId, telegramChatId: draft.telegramChatId, sourceType: draft.sourceType, originalInput: draft.originalInput, createdAt: draft.createdAt, status: "pending", updatedAt });
    const nextField = selectClarificationField(updated);
    if (!nextField) await this.states.removeByUser(telegramUserId);
    else await this.states.save({ ...state, mode: "awaiting_clarification", requestedField: nextField, updatedAt });
    return { outcome: "updated", draft: updated, nextField };
  }

  private newState(draft: TransactionDraft, mode: ConversationState["mode"], requestedField?: ConversationRequestedField): ConversationState {
    const timestamp = this.now().toISOString();
    return { telegramUserId: draft.telegramUserId, telegramChatId: draft.telegramChatId, draftId: draft.id, mode, ...(requestedField ? { requestedField } : {}), createdAt: timestamp, updatedAt: timestamp };
  }
}
