import { getClarificationQuestion } from "@/features/transaction-agent/clarification";
import { ConversationService, type BatchContext } from "@/features/transaction-agent/conversation-service";
import { isConversationStateExpired, type QueuedAction } from "@/features/transaction-agent/conversation-state";
import { reextractTransactionDraft, extractTransactionFromText } from "@/features/transaction-agent/transaction-extractor";
import { extractMultiIntentFromText } from "@/features/transaction-agent/multi-intent-extractor";
import { buildMultiIntentNotes, splitMultiIntentTransactions } from "@/features/transaction-agent/multi-intent-input";
import { TransactionDraftService } from "@/features/transaction-agent/transaction-confirmation";
import type { TransactionDraft } from "@/features/transaction-agent/transaction-record.schema";
import type { DraftRepository } from "@/features/transaction-agent/transaction-repositories";
import type { TransactionExtraction } from "@/features/transaction-agent/transaction.schema";

export type TransactionInput = {
  text: string;
  telegramUserId: string;
  telegramChatId: string;
  sourceType: TransactionDraft["sourceType"];
  transcript?: string;
  telegramFileId?: string;
  defaultPaymentMethod?: Exclude<TransactionExtraction["paymentMethod"], "unknown"> | null;
  locale?: "en" | "ms";
};

/** Position of the active draft within a multi-intent batch, for presentation copy. */
export type BatchProgress = { index: number; total: number };

export type TransactionInputResult =
  | { outcome: "clarification"; question: string; draft: TransactionDraft; requestedField: NonNullable<Awaited<ReturnType<ConversationService["beginClarification"]>>>; restarted: boolean; batch?: BatchProgress; notes?: string[] }
  | { outcome: "draft"; draft: TransactionDraft; restarted: boolean; batch?: BatchProgress; notes?: string[] }
  | { outcome: "expired" }
  | { outcome: "unavailable" };

type Extract = typeof extractTransactionFromText;
type Reextract = typeof reextractTransactionDraft;
type MultiExtract = typeof extractMultiIntentFromText;

export function applyDefaultPaymentMethod(
  extraction: TransactionExtraction,
  defaultPaymentMethod: TransactionInput["defaultPaymentMethod"],
): TransactionExtraction {
  return extraction.paymentMethod === "unknown" && defaultPaymentMethod
    ? {
        ...extraction,
        paymentMethod: defaultPaymentMethod,
        missingFields: extraction.missingFields.filter((field) => field !== "paymentMethod"),
      }
    : extraction;
}

/** Simple answers to a targeted prompt are user-confirmed values, not a new extraction task. */
export function applyDirectClarification(
  currentDraft: TransactionDraft,
  requestedField: string | undefined,
  reply: string,
): TransactionExtraction | null {
  const value = reply.trim();
  if (!value) return null;
  if (requestedField === "purpose") {
    const description = value.replace(/^for\s+/i, "").trim();
    if (!description) return null;
    return { ...currentDraft, description, missingFields: currentDraft.missingFields.filter((field) => field !== "purpose" && field !== "description") };
  }
  if (requestedField === "merchantOrCustomer") {
    return { ...currentDraft, merchantOrCustomer: value, missingFields: currentDraft.missingFields.filter((field) => field !== "merchantOrCustomer") };
  }
  if (requestedField === "paymentMethod") {
    const normalized = value.toLocaleLowerCase().replace(/[\s_-]+/g, "");
    const paymentMethod = ({ cash: "cash", banktransfer: "bank_transfer", card: "card", ewallet: "ewallet", credit: "credit" } as const)[normalized];
    if (!paymentMethod) return null;
    return { ...currentDraft, paymentMethod, missingFields: currentDraft.missingFields.filter((field) => field !== "paymentMethod") };
  }
  return null;
}

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
      /** When provided, a fresh message is parsed for up to three actions at once. */
      extractMultiIntent?: MultiExtract;
    },
  ) {}

  async process(input: TransactionInput): Promise<TransactionInputResult> {
    const reextract = this.dependencies.reextract ?? reextractTransactionDraft;
    let state = await this.dependencies.conversations.getActive(input.telegramUserId, input.telegramChatId);
    let restarted = false;

    if (state && isConversationStateExpired(state)) {
      const expiredDraft = await this.dependencies.drafts.findById(state.draftId);
      if (expiredDraft?.status === "pending" && expiredDraft.telegramUserId === input.telegramUserId) {
        await this.dependencies.draftService.act({ action: "cancel", draftId: expiredDraft.id, telegramUserId: input.telegramUserId });
      }
      await this.dependencies.conversations.expire(state);
      // Expiry is terminal. Leaving the state active makes every subsequent
      // message hit this branch, despite telling the owner to start over.
      await this.dependencies.conversations.clearByUser(input.telegramUserId, input.telegramChatId);
      state = null;
      restarted = true;
    }

    if (state) {
      if (["completed", "cancelled", "failed"].includes(state.workflowStatus)) state = null;
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
        const history = state.history?.map((turn) => turn.text);
        const extraction = applyDirectClarification(currentDraft, state.requestedField, input.text) ?? await reextract({
          originalInput: currentDraft.originalInput,
          currentDraft,
          requestedField: state.requestedField,
          reply: input.text,
          apiKey: this.dependencies.apiKey,
          model: this.dependencies.model,
          ...(history?.length ? { history } : {}),
        });
        const result = await this.dependencies.conversations.replaceDraft({ state, telegramUserId: input.telegramUserId, extraction, reply: input.text });
        if (result.outcome !== "updated") return { outcome: "unavailable" };
        if (result.nextField) return { outcome: "clarification", question: getClarificationQuestion(result.nextField), draft: result.draft, requestedField: result.nextField, restarted: false };
        // replaceDraft already transitioned the state to awaiting_review, preserving the batch
        // queue and turn history; re-running beginReview here would discard them.
        return { outcome: "draft", draft: result.draft, restarted: false };
      }
    }

    const { extractions, notes } = await this.extractFreshActions(input);
    const [first, ...rest] = extractions.map((extraction) => applyDefaultPaymentMethod(extraction, input.defaultPaymentMethod));
    const queuedActions: QueuedAction[] = rest.map((extraction) => ({ extraction, originalInput: input.text, sourceType: input.sourceType }));
    const total = extractions.length;
    const batch: BatchContext | undefined = total > 1 ? { queuedActions, batchIndex: 1, batchSize: total } : undefined;
    const progress: BatchProgress | undefined = total > 1 ? { index: 1, total } : undefined;

    const draft = await this.dependencies.draftService.createDraft({
      extraction: first,
      telegramUserId: input.telegramUserId,
      telegramChatId: input.telegramChatId,
      originalInput: input.text,
      sourceType: input.sourceType,
      transcript: input.transcript,
      telegramFileId: input.telegramFileId,
    });
    const requestedField = await this.dependencies.conversations.beginClarification(draft, batch);
    if (requestedField) return { outcome: "clarification", question: getClarificationQuestion(requestedField), draft, requestedField, restarted, ...(progress ? { batch: progress } : {}), ...(notes.length ? { notes } : {}) };
    await this.dependencies.conversations.beginReview(draft, batch);
    return { outcome: "draft", draft, restarted, ...(progress ? { batch: progress } : {}), ...(notes.length ? { notes } : {}) };
  }

  /** Extracts the actionable transactions from a fresh message, using multi-intent when wired. */
  private async extractFreshActions(input: TransactionInput): Promise<{ extractions: TransactionExtraction[]; notes: string[] }> {
    const extract = this.dependencies.extract ?? extractTransactionFromText;
    if (!this.dependencies.extractMultiIntent) {
      return { extractions: [await extract({ input: input.text, apiKey: this.dependencies.apiKey, model: this.dependencies.model })], notes: [] };
    }
    const multi = await this.dependencies.extractMultiIntent({ input: input.text, apiKey: this.dependencies.apiKey, model: this.dependencies.model });
    const extractions = splitMultiIntentTransactions(multi);
    const notes = buildMultiIntentNotes(multi, input.locale ?? "en");
    // A message with no actionable transaction (e.g. only a receivable) still needs one draft to
    // review; fall back to single extraction so the owner is never left with nothing to act on.
    if (extractions.length === 0) {
      return { extractions: [await extract({ input: input.text, apiKey: this.dependencies.apiKey, model: this.dependencies.model })], notes };
    }
    return { extractions, notes };
  }

  /**
   * Promotes the next queued multi-intent action into the active draft after the current one is
   * confirmed or cancelled. Returns null when no batch remains.
   */
  async advanceBatch(input: { telegramUserId: string; telegramChatId: string }): Promise<TransactionInputResult | null> {
    const state = await this.dependencies.conversations.getActive(input.telegramUserId, input.telegramChatId);
    const queue = state?.queuedActions ?? [];
    const next = queue[0];
    if (!state || !next) return null;
    const remaining = queue.slice(1);
    const total = state.batchSize ?? queue.length + 1;
    const index = (state.batchIndex ?? 1) + 1;
    const batch: BatchContext = { queuedActions: remaining, batchIndex: index, batchSize: total };

    const draft = await this.dependencies.draftService.createDraft({
      extraction: next.extraction,
      telegramUserId: input.telegramUserId,
      telegramChatId: input.telegramChatId,
      originalInput: next.originalInput,
      sourceType: next.sourceType,
    });
    const progress: BatchProgress = { index, total };
    const requestedField = await this.dependencies.conversations.beginClarification(draft, batch);
    if (requestedField) return { outcome: "clarification", question: getClarificationQuestion(requestedField), draft, requestedField, restarted: false, batch: progress };
    await this.dependencies.conversations.beginReview(draft, batch);
    return { outcome: "draft", draft, restarted: false, batch: progress };
  }
}
