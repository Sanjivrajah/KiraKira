import { getClarificationQuestion } from "@/features/transaction-agent/clarification";
import { ConversationService } from "@/features/transaction-agent/conversation-service";
import { isConversationStateExpired } from "@/features/transaction-agent/conversation-state";
import { reextractTransactionDraft, extractTransactionFromText } from "@/features/transaction-agent/transaction-extractor";
import { TransactionDraftService } from "@/features/transaction-agent/transaction-confirmation";
import type { TransactionDraft } from "@/features/transaction-agent/transaction-record.schema";
import type { DraftRepository } from "@/features/transaction-agent/transaction-repositories";

export type TransactionInput = {
  text: string;
  telegramUserId: string;
  telegramChatId: string;
  sourceType: TransactionDraft["sourceType"];
  transcript?: string;
  telegramFileId?: string;
};

export type TransactionInputResult =
  | { outcome: "clarification"; question: string; draft: TransactionDraft; requestedField: NonNullable<Awaited<ReturnType<ConversationService["beginClarification"]>>>; restarted: boolean }
  | { outcome: "draft"; draft: TransactionDraft; restarted: boolean }
  | { outcome: "unavailable" };

type Extract = typeof extractTransactionFromText;
type Reextract = typeof reextractTransactionDraft;

/** Single entry point for text and transcribed voice transaction input. */
export class TransactionInputProcessor {
  constructor(
    private readonly dependencies: {
      drafts: DraftRepository;
      draftService: TransactionDraftService;
      conversations: ConversationService;
      apiKey: string;
      model: string;
      extract?: Extract;
      reextract?: Reextract;
    },
  ) {}

  async process(input: TransactionInput): Promise<TransactionInputResult> {
    const extract = this.dependencies.extract ?? extractTransactionFromText;
    const reextract = this.dependencies.reextract ?? reextractTransactionDraft;
    let state = await this.dependencies.conversations.getActive(input.telegramUserId, input.telegramChatId);
    let restarted = false;

    if (state && isConversationStateExpired(state)) {
      const expiredDraft = await this.dependencies.drafts.findById(state.draftId);
      if (expiredDraft?.status === "pending" && expiredDraft.telegramUserId === input.telegramUserId) {
        await this.dependencies.draftService.act({ action: "cancel", draftId: expiredDraft.id, telegramUserId: input.telegramUserId });
      }
      await this.dependencies.conversations.clearByUser(input.telegramUserId, input.telegramChatId);
      state = null;
      restarted = true;
    }

    if (state) {
      const currentDraft = await this.dependencies.drafts.findById(state.draftId);
      if (!currentDraft || currentDraft.telegramUserId !== input.telegramUserId || currentDraft.status !== "pending") {
        await this.dependencies.conversations.clearByUser(input.telegramUserId, input.telegramChatId);
        state = null;
        restarted = true;
      } else {
        if (state.mode === "awaiting_review" || state.mode === "awaiting_replacement") {
          await this.dependencies.conversations.proposeReplacement(currentDraft, {
            text: input.text,
            sourceType: input.sourceType,
            ...(input.transcript ? { transcript: input.transcript } : {}),
            ...(input.telegramFileId ? { telegramFileId: input.telegramFileId } : {}),
          });
          return { outcome: "unavailable" };
        }
        const extraction = await reextract({
          originalInput: currentDraft.originalInput,
          currentDraft,
          requestedField: state.requestedField,
          reply: input.text,
          apiKey: this.dependencies.apiKey,
          model: this.dependencies.model,
        });
        const result = await this.dependencies.conversations.replaceDraft({ state, telegramUserId: input.telegramUserId, extraction });
        if (result.outcome !== "updated") return { outcome: "unavailable" };
        if (result.nextField) return { outcome: "clarification", question: getClarificationQuestion(result.nextField), draft: result.draft, requestedField: result.nextField, restarted: false };
        await this.dependencies.conversations.beginReview(result.draft);
        return { outcome: "draft", draft: result.draft, restarted: false };
      }
    }

    const extraction = await extract({ input: input.text, apiKey: this.dependencies.apiKey, model: this.dependencies.model });
    const draft = await this.dependencies.draftService.createDraft({
      extraction,
      telegramUserId: input.telegramUserId,
      telegramChatId: input.telegramChatId,
      originalInput: input.text,
      sourceType: input.sourceType,
      transcript: input.transcript,
      telegramFileId: input.telegramFileId,
    });
    const requestedField = await this.dependencies.conversations.beginClarification(draft);
    if (requestedField) return { outcome: "clarification", question: getClarificationQuestion(requestedField), draft, requestedField, restarted };
    await this.dependencies.conversations.beginReview(draft);
    return { outcome: "draft", draft, restarted };
  }
}
