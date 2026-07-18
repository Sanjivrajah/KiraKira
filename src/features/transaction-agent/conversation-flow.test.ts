import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getClarificationQuestion, normalizeMissingFields, selectClarificationField } from "@/features/transaction-agent/clarification";
import { CONVERSATION_STATE_EXPIRY_MS, conversationStateSchema, isConversationStateExpired, type ConversationState } from "@/features/transaction-agent/conversation-state";
import { LocalConversationStateRepository } from "@/features/transaction-agent/conversation-repository";
import { ConversationService } from "@/features/transaction-agent/conversation-service";
import { TransactionDraftService } from "@/features/transaction-agent/transaction-confirmation";
import { reextractTransactionDraft, TransactionExtractionError, type TransactionExtractionClient } from "@/features/transaction-agent/transaction-extractor";
import { createLocalTransactionRepositories } from "@/features/transaction-agent/transaction-repositories";
import type { TransactionExtraction } from "@/features/transaction-agent/transaction.schema";

const directories: string[] = [];
async function makeDirectory() { const directory = await mkdtemp(join(tmpdir(), "niagaai-conversation-flow-")); directories.push(directory); return directory; }
afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

const incomplete: TransactionExtraction = { type: "expense", amount: 300, currency: "MYR", description: "", merchantOrCustomer: "Ali", paymentMethod: "unknown", transactionDate: null, category: null, quantity: null, unit: null, missingFields: ["purpose", "transactionDate", "paymentMethod"], confidence: 0.55 };
const complete: TransactionExtraction = { ...incomplete, description: "Stock for the shop", paymentMethod: "bank_transfer", transactionDate: "2026-07-15", category: "Inventory", missingFields: [], confidence: 0.95 };
const workflowFields = { workflowId: "00000000-0000-4000-8000-000000000099", workflowType: "transaction_capture" as const, workflowVersion: 1 as const, workflowStatus: "awaiting_clarification" as const, collectedValues: {}, expiresAt: "2026-07-15T00:30:00.000Z" };

async function makeFlow() {
  const directory = await makeDirectory();
  const repositories = createLocalTransactionRepositories(directory);
  const now = () => new Date("2026-07-15T00:00:00.000Z");
  const drafts = new TransactionDraftService(repositories.drafts, repositories.transactions, now);
  const states = new LocalConversationStateRepository(directory);
  const conversations = new ConversationService(repositories.drafts, states, now);
  const draft = await drafts.createDraft({ extraction: incomplete, telegramUserId: "owner", telegramChatId: "chat-1", originalInput: "Paid supplier Ali RM300" });
  return { repositories, drafts, states, conversations, draft };
}

describe("clarification flow", () => {
  it("prioritises missing fields and selects concise questions", () => {
    expect(selectClarificationField(incomplete)).toBe("purpose");
    expect(getClarificationQuestion("purpose")).toBe("What was this payment or transaction for?");
    expect(selectClarificationField({ ...incomplete, amount: null, missingFields: ["amount", "purpose"] })).toBe("amount");
    expect(normalizeMissingFields({ ...incomplete, description: "Stock barang kedai", missingFields: ["purpose", "transactionDate", "paymentMethod"] }).missingFields).toEqual(["transactionDate", "paymentMethod"]);
    expect(selectClarificationField({ ...incomplete, description: "Stock barang kedai", missingFields: ["purpose", "transactionDate", "paymentMethod"] })).toBe("transactionDate");
  });

  it("creates, loads, updates, and removes persisted conversation state", async () => {
    const directory = await makeDirectory();
    const states = new LocalConversationStateRepository(directory);
    const state: ConversationState = { ...workflowFields, telegramUserId: "user-1", telegramChatId: "chat-1", draftId: "00000000-0000-4000-8000-000000000000", mode: "awaiting_clarification", requestedField: "amount", createdAt: "2026-07-15T00:00:00.000Z", updatedAt: "2026-07-15T00:00:00.000Z" };
    await states.save(state);
    await expect(states.findByUser("user-1")).resolves.toEqual(state);
    await states.save({ ...state, requestedField: "purpose", updatedAt: "2026-07-15T00:01:00.000Z" });
    await expect(states.findByUser("user-1")).resolves.toMatchObject({ requestedField: "purpose" });
    await states.removeByUser("user-1");
    await expect(states.findByUser("user-1")).resolves.toBeNull();
  });

  it("isolates concurrent conversation flows by both Telegram user and chat", async () => {
    const directory = await makeDirectory();
    const states = new LocalConversationStateRepository(directory);
    const baseState: ConversationState = { ...workflowFields, telegramUserId: "user-1", telegramChatId: "chat-1", draftId: "00000000-0000-4000-8000-000000000000", mode: "awaiting_clarification", requestedField: "amount", createdAt: "2026-07-15T00:00:00.000Z", updatedAt: "2026-07-15T00:00:00.000Z" };
    const otherChatState: ConversationState = { ...baseState, telegramChatId: "chat-2", draftId: "00000000-0000-4000-8000-000000000001" };

    await states.save(baseState);
    await states.save(otherChatState);

    await expect(states.findByUser("user-1", "chat-1")).resolves.toEqual(baseState);
    await expect(states.findByUser("user-1", "chat-2")).resolves.toEqual(otherChatState);
    await states.removeByUser("user-1", "chat-1");
    await expect(states.findByUser("user-1", "chat-1")).resolves.toBeNull();
    await expect(states.findByUser("user-1", "chat-2")).resolves.toEqual(otherChatState);
  });

  it("detects expiration using the single local expiry constant", () => {
    const state: ConversationState = { ...workflowFields, telegramUserId: "user-1", telegramChatId: "chat-1", draftId: "00000000-0000-4000-8000-000000000000", mode: "awaiting_correction", createdAt: "2026-07-15T00:00:00.000Z", updatedAt: "2026-07-15T00:00:00.000Z" };
    expect(isConversationStateExpired(state, new Date(Date.parse(state.updatedAt) + CONVERSATION_STATE_EXPIRY_MS - 1))).toBe(false);
    expect(isConversationStateExpired(state, new Date(Date.parse(state.updatedAt) + CONVERSATION_STATE_EXPIRY_MS))).toBe(true);
  });

  it("migrates legacy local state into a versioned transaction workflow", () => {
    const migrated = conversationStateSchema.parse({ telegramUserId: "user-1", telegramChatId: "chat-1", draftId: "00000000-0000-4000-8000-000000000000", mode: "awaiting_review", createdAt: "2026-07-15T00:00:00.000Z", updatedAt: "2026-07-15T00:00:00.000Z" });
    expect(migrated).toMatchObject({ workflowType: "transaction_capture", workflowVersion: 1, workflowStatus: "awaiting_confirmation" });
    expect(migrated.expiresAt).toBe("2026-07-15T00:30:00.000Z");
  });

  it("marks an expired workflow terminal instead of deleting its state", async () => {
    const { conversations, draft, states } = await makeFlow();
    await conversations.beginReview(draft);
    const state = (await states.findByUser("owner"))!;
    await conversations.expire(state);
    await expect(states.findByUser("owner")).resolves.toMatchObject({ draftId: draft.id, workflowStatus: "expired" });
  });

  it("moves to the next missing field and preserves identity during replacement", async () => {
    const { conversations, draft, states, repositories } = await makeFlow();
    await conversations.beginClarification(draft);
    const state = await states.findByUser("owner");
    expect(state?.requestedField).toBe("purpose");
    const result = await conversations.replaceDraft({ state: state!, telegramUserId: "owner", extraction: { ...incomplete, description: "Stock for the shop", missingFields: ["transactionDate", "paymentMethod"] } });
    expect(result).toMatchObject({ outcome: "updated", nextField: "transactionDate", draft: { id: draft.id, telegramUserId: "owner", originalInput: "Paid supplier Ali RM300", createdAt: draft.createdAt } });
    expect(await states.findByUser("owner")).toMatchObject({ requestedField: "transactionDate" });
    expect(await repositories.drafts.findById(draft.id)).toMatchObject({ description: "Stock for the shop" });
  });

  it("moves the state to review once a replacement draft is complete", async () => {
    const { conversations, draft, states } = await makeFlow();
    await conversations.beginClarification(draft);
    const result = await conversations.replaceDraft({ state: (await states.findByUser("owner"))!, telegramUserId: "owner", extraction: complete });
    expect(result).toMatchObject({ outcome: "updated", nextField: null, draft: { id: draft.id, missingFields: [] } });
    await expect(states.findByUser("owner")).resolves.toMatchObject({ mode: "awaiting_review", workflowStatus: "awaiting_confirmation" });
  });

  it("stops asking after the clarification-turn cap and moves an incomplete draft to review", async () => {
    const { conversations, draft, states } = await makeFlow();
    await conversations.beginClarification(draft);
    // The extraction stays incomplete every round, so only the turn cap can end the loop.
    let last;
    for (let round = 0; round < 6; round += 1) {
      const state = (await states.findByUser("owner"))!;
      last = await conversations.replaceDraft({ state, telegramUserId: "owner", extraction: incomplete });
    }
    expect(last).toMatchObject({ outcome: "updated", nextField: null });
    await expect(states.findByUser("owner")).resolves.toMatchObject({ mode: "awaiting_review", clarificationTurns: 6 });
  });

  it("enters correction mode without cancelling the pending draft", async () => {
    const { conversations, drafts, states, draft, repositories } = await makeFlow();
    const result = await drafts.act({ action: "correct", draftId: draft.id, telegramUserId: "owner" });
    expect(result).toMatchObject({ outcome: "correct", draft: { id: draft.id } });
    if (result.outcome === "correct") await conversations.beginCorrection(result.draft);
    await expect(states.findByUser("owner")).resolves.toMatchObject({ mode: "awaiting_correction" });
    await expect(repositories.drafts.findById(draft.id)).resolves.toMatchObject({ status: "pending" });
  });

  it("clears state when a pending draft is cancelled and rejects another user's update", async () => {
    const { conversations, drafts, states, draft } = await makeFlow();
    await conversations.beginClarification(draft);
    const state = (await states.findByUser("owner"))!;
    await expect(conversations.replaceDraft({ state, telegramUserId: "other", extraction: complete })).resolves.toEqual({ outcome: "not_owner" });
    await drafts.act({ action: "cancel", draftId: draft.id, telegramUserId: "owner" });
    await conversations.clearByDraftId(draft.id);
    await expect(states.findByUser("owner")).resolves.toBeNull();
  });

  it("rejects malformed re-extraction output without a paid OpenAI call", async () => {
    const parse = vi.fn().mockResolvedValue({ output_parsed: { ...complete, confidence: 2 } });
    const client = { responses: { parse } } as unknown as TransactionExtractionClient;
    await expect(reextractTransactionDraft({ originalInput: "Paid supplier Ali RM300", currentDraft: incomplete, requestedField: "purpose", reply: "Stock barang kedai", apiKey: "test-key", model: "test-model", client })).rejects.toBeInstanceOf(TransactionExtractionError);
    expect(parse).toHaveBeenCalledOnce();
  });
});
