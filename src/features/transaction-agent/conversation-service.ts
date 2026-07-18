import { normalizeMissingFields, selectClarificationField } from "@/features/transaction-agent/clarification";
import { CONVERSATION_STATE_EXPIRY_MS, type ConversationState, type ConversationRequestedField } from "@/features/transaction-agent/conversation-state";
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
    await this.states.save(this.newState(draft, "awaiting_clarification", "awaiting_clarification", requestedField));
    return requestedField;
  }
  async beginCorrection(draft: TransactionDraft): Promise<void> { await this.states.save(this.newState(draft, "awaiting_correction", "awaiting_clarification")); }
  async beginCorrectionField(draft: TransactionDraft, requestedField: ConversationRequestedField): Promise<void> { await this.states.save(this.newState(draft, "awaiting_correction", "awaiting_clarification", requestedField)); }
  async beginReview(draft: TransactionDraft): Promise<void> { await this.states.save(this.newState(draft, "awaiting_review", "awaiting_confirmation")); }
  async proposeReplacement(draft: TransactionDraft, replacementInput: NonNullable<ConversationState["replacementInput"]>): Promise<void> {
    const current = await this.states.findByUser(draft.telegramUserId, draft.telegramChatId);
    await this.states.save({ ...this.newState(draft, "awaiting_replacement", "routing"), replacementInput, ...(current?.inlineMessageId ? { inlineMessageId: current.inlineMessageId } : {}) });
  }
  async continueReview(draft: TransactionDraft): Promise<void> { await this.beginReview(draft); }
  async attachInlineMessage(telegramUserId: string, telegramChatId: string, inlineMessageId: number): Promise<void> {
    const current = await this.states.findByUser(telegramUserId, telegramChatId);
    if (current) await this.states.save({ ...current, inlineMessageId });
  }
  async getActive(telegramUserId: string, telegramChatId?: string): Promise<ConversationState | null> { return this.states.findByUser(telegramUserId, telegramChatId); }
  async clearByUser(telegramUserId: string, telegramChatId?: string): Promise<void> { await this.states.removeByUser(telegramUserId, telegramChatId); }
  async clearByDraftId(draftId: string): Promise<void> { await this.states.removeByDraftId(draftId); }
  async expire(state: ConversationState): Promise<void> {
    await this.states.save({ ...state, workflowStatus: "expired", updatedAt: this.now().toISOString() });
  }
  async cancel(state: ConversationState): Promise<void> {
    await this.states.save({ ...state, workflowStatus: "cancelled", updatedAt: this.now().toISOString() });
  }
  async complete(state: ConversationState): Promise<void> {
    await this.states.save({ ...state, workflowStatus: "completed", updatedAt: this.now().toISOString() });
  }

  async replaceDraft({ state, telegramUserId, extraction }: { state: ConversationState; telegramUserId: string; extraction: TransactionExtraction }): Promise<ConversationUpdateResult> {
    const draft = await this.drafts.findById(state.draftId);
    if (!draft) { await this.states.removeByUser(telegramUserId, state.telegramChatId); return { outcome: "missing" }; }
    if (draft.telegramUserId !== telegramUserId || state.telegramUserId !== telegramUserId || draft.telegramChatId !== state.telegramChatId) return { outcome: "not_owner" };
    if (draft.status !== "pending") { await this.states.removeByUser(telegramUserId, state.telegramChatId); return { outcome: "expired" }; }
    const updatedAt = this.now().toISOString();
    const normalizedExtraction = normalizeMissingFields(extraction);
    const updated = await this.drafts.update({ ...draft, ...normalizedExtraction, id: draft.id, telegramUserId: draft.telegramUserId, telegramChatId: draft.telegramChatId, sourceType: draft.sourceType, originalInput: draft.originalInput, createdAt: draft.createdAt, status: "pending", updatedAt });
    const nextField = selectClarificationField(updated);
    if (!nextField) {
      // Keep the state until the owner reviews, corrects, confirms, or cancels
      // the completed draft. Supabase state saves are optimistic updates, so
      // deleting here would make the following beginReview transition stale.
      await this.states.save({ ...state, mode: "awaiting_review", workflowStatus: "awaiting_confirmation", requestedField: undefined, updatedAt, expiresAt: new Date(this.now().getTime() + CONVERSATION_STATE_EXPIRY_MS).toISOString() });
    } else {
      await this.states.save({ ...state, mode: "awaiting_clarification", workflowStatus: "awaiting_clarification", requestedField: nextField, updatedAt, expiresAt: new Date(this.now().getTime() + CONVERSATION_STATE_EXPIRY_MS).toISOString() });
    }
    return { outcome: "updated", draft: updated, nextField };
  }

  private newState(draft: TransactionDraft, mode: ConversationState["mode"], workflowStatus: ConversationState["workflowStatus"], requestedField?: ConversationRequestedField): ConversationState {
    const timestamp = this.now().toISOString();
    return { telegramUserId: draft.telegramUserId, telegramChatId: draft.telegramChatId, draftId: draft.id, workflowId: crypto.randomUUID(), workflowType: "transaction_capture", workflowVersion: 1, workflowStatus, mode, ...(requestedField ? { requestedField } : {}), collectedValues: {}, expiresAt: new Date(this.now().getTime() + CONVERSATION_STATE_EXPIRY_MS).toISOString(), createdAt: timestamp, updatedAt: timestamp };
  }
}
