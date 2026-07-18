import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConversationService } from "./conversation-service";
import { LocalConversationStateRepository } from "./conversation-repository";
import { TransactionDraftService } from "./transaction-confirmation";
import { applyDirectClarification, TransactionInputProcessor } from "./transaction-input-processor";
import { createLocalTransactionRepositories } from "./transaction-repositories";
import type { TransactionExtraction } from "./transaction.schema";

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

const incomplete: TransactionExtraction = { type: "expense", amount: 300, currency: "MYR", description: "", merchantOrCustomer: "Ali", paymentMethod: "cash", transactionDate: "2026-07-15", category: null, quantity: null, unit: null, missingFields: ["purpose"], confidence: 0.6 };
const complete: TransactionExtraction = { ...incomplete, description: "Shop inventory", missingFields: [], confidence: 0.9 };
const sale: TransactionExtraction = { type: "income", amount: 25, currency: "MYR", description: "Sale of nasi lemak", merchantOrCustomer: null, paymentMethod: "cash", transactionDate: "2026-07-18", category: "Sales revenue", quantity: null, unit: null, missingFields: [], confidence: 0.92 };

async function makeProcessor(extract = vi.fn().mockResolvedValue(complete), reextract = vi.fn().mockResolvedValue(complete)) {
  const directory = await mkdtemp(join(tmpdir(), "niagaai-input-")); directories.push(directory);
  const repositories = createLocalTransactionRepositories(directory);
  const drafts = new TransactionDraftService(repositories.drafts, repositories.transactions);
  const conversations = new ConversationService(repositories.drafts, new LocalConversationStateRepository(directory));
  return {
    repositories,
    conversations,
    processor: new TransactionInputProcessor({ drafts: repositories.drafts, draftService: drafts, conversations, apiKey: "key", model: "model", extract: extract as never, reextract: reextract as never }),
  };
}

describe("TransactionInputProcessor", () => {
  it("routes a new voice transcript through the new-transaction flow without confirming it", async () => {
    const { processor, repositories } = await makeProcessor();
    const result = await processor.process({ text: "Semalam beli ayam RM85 cash", transcript: "Semalam beli ayam RM85 cash", telegramFileId: "telegram-file", sourceType: "telegram_voice", telegramUserId: "user", telegramChatId: "chat" });
    expect(result).toMatchObject({ outcome: "draft", draft: { sourceType: "telegram_voice", transcript: "Semalam beli ayam RM85 cash", telegramFileId: "telegram-file", status: "pending" } });
    await expect(repositories.transactions.listByUser("user")).resolves.toEqual([]);
  });

  it("prefills a configured payment method only when a new extraction does not specify one", async () => {
    const withoutPayment: TransactionExtraction = { ...complete, paymentMethod: "unknown", missingFields: ["paymentMethod"] };
    const { processor } = await makeProcessor(vi.fn().mockResolvedValue(withoutPayment));

    const result = await processor.process({ text: "Bought inventory RM300", sourceType: "telegram_text", telegramUserId: "user", telegramChatId: "chat", defaultPaymentMethod: "bank_transfer" });

    expect(result).toMatchObject({ outcome: "draft", draft: { paymentMethod: "bank_transfer", missingFields: [], status: "pending" } });
  });

  it("keeps an explicitly extracted payment method instead of overwriting it with the default", async () => {
    const { processor } = await makeProcessor(vi.fn().mockResolvedValue(complete));

    const result = await processor.process({ text: "Bought inventory RM300 cash", sourceType: "telegram_text", telegramUserId: "user", telegramChatId: "chat", defaultPaymentMethod: "bank_transfer" });

    expect(result).toMatchObject({ outcome: "draft", draft: { paymentMethod: "cash" } });
  });

  it("uses a voice transcript as the reply to an active clarification without another model call for a purpose", async () => {
    const reextract = vi.fn().mockResolvedValue(complete);
    const { processor, repositories, conversations } = await makeProcessor(vi.fn().mockResolvedValue(incomplete), reextract);
    const first = await processor.process({ text: "Paid Ali RM300", sourceType: "telegram_text", telegramUserId: "user", telegramChatId: "chat" });
    expect(first).toMatchObject({ outcome: "clarification" });
    const result = await processor.process({ text: "It was for shop inventory", sourceType: "telegram_voice", transcript: "It was for shop inventory", telegramUserId: "user", telegramChatId: "chat" });
    expect(result).toMatchObject({ outcome: "draft", draft: { description: "It was for shop inventory", sourceType: "telegram_text" } });
    expect(reextract).not.toHaveBeenCalled();
    await expect(conversations.getActive("user")).resolves.toMatchObject({ mode: "awaiting_review" });
    await expect(repositories.transactions.listByUser("user")).resolves.toEqual([]);
  });

  it("accepts a short purpose reply such as the screenshot example instead of asking again", () => {
    expect(applyDirectClarification({ ...incomplete, id: "00000000-0000-4000-8000-000000000001", telegramUserId: "user", telegramChatId: "chat", sourceType: "telegram_text", originalInput: "Paid Amir RM100", status: "pending", createdAt: "2026-07-17T00:00:00.000Z", updatedAt: "2026-07-17T00:00:00.000Z" }, "purpose", "for flowers")).toMatchObject({ description: "flowers", missingFields: [] });
  });

  it("accepts a payment-method button value without re-extracting the draft", () => {
    expect(applyDirectClarification({ ...incomplete, paymentMethod: "unknown", missingFields: ["paymentMethod"], id: "00000000-0000-4000-8000-000000000001", telegramUserId: "user", telegramChatId: "chat", sourceType: "telegram_text", originalInput: "Paid Amir RM100", status: "pending", createdAt: "2026-07-17T00:00:00.000Z", updatedAt: "2026-07-17T00:00:00.000Z" }, "paymentMethod", "Bank transfer")).toMatchObject({ paymentMethod: "bank_transfer", missingFields: [] });
  });

  it("does not apply one chat's clarification state to another chat for the same user", async () => {
    const extract = vi.fn().mockResolvedValueOnce(incomplete).mockResolvedValueOnce(complete);
    const reextract = vi.fn().mockResolvedValue(complete);
    const { processor, conversations } = await makeProcessor(extract, reextract);

    await processor.process({ text: "Paid Ali RM300", sourceType: "telegram_text", telegramUserId: "user", telegramChatId: "chat-1" });
    const second = await processor.process({ text: "Bought shop inventory RM300 cash", sourceType: "telegram_text", telegramUserId: "user", telegramChatId: "chat-2" });

    expect(second).toMatchObject({ outcome: "draft", draft: { telegramChatId: "chat-2", description: "Shop inventory" } });
    expect(reextract).not.toHaveBeenCalled();
    await expect(conversations.getActive("user", "chat-1")).resolves.toMatchObject({ telegramChatId: "chat-1" });
    await expect(conversations.getActive("user", "chat-2")).resolves.toMatchObject({ mode: "awaiting_review" });
  });

  it("does not silently replace a reviewable draft when a second transaction arrives", async () => {
    const extract = vi.fn().mockResolvedValue(complete);
    const { processor, conversations } = await makeProcessor(extract);
    const first = await processor.process({ text: "Bought inventory RM300 cash", sourceType: "telegram_text", telegramUserId: "user", telegramChatId: "chat" });
    expect(first).toMatchObject({ outcome: "draft" });
    const second = await processor.process({ text: "Sold cakes RM500 cash", sourceType: "telegram_text", telegramUserId: "user", telegramChatId: "chat" });
    expect(second).toEqual({ outcome: "unavailable" });
    expect(extract).toHaveBeenCalledOnce();
    await expect(conversations.getActive("user", "chat")).resolves.toMatchObject({ mode: "awaiting_replacement", replacementInput: { text: "Sold cakes RM500 cash" } });
  });

  it("records owner replies and feeds prior turns back into the next re-extraction", async () => {
    // amount and date both route through re-extraction (not the local clarification shortcut).
    const initial: TransactionExtraction = { ...complete, amount: null, transactionDate: null, missingFields: ["amount", "transactionDate"], confidence: 0.6 };
    const afterAmount: TransactionExtraction = { ...initial, amount: 300, missingFields: ["transactionDate"] };
    const reextract = vi.fn().mockResolvedValueOnce(afterAmount).mockResolvedValueOnce(complete);
    const { processor, conversations } = await makeProcessor(vi.fn().mockResolvedValue(initial), reextract);

    await processor.process({ text: "Bought stock at Ali", sourceType: "telegram_text", telegramUserId: "user", telegramChatId: "chat" });
    await processor.process({ text: "RM300", sourceType: "telegram_text", telegramUserId: "user", telegramChatId: "chat" });
    await processor.process({ text: "yesterday", sourceType: "telegram_text", telegramUserId: "user", telegramChatId: "chat" });

    // The second re-extraction should see the first reply as prior history.
    expect(reextract.mock.calls[0]?.[0].history).toBeUndefined();
    expect(reextract.mock.calls[1]?.[0].history).toEqual(["RM300"]);
    await expect(conversations.getActive("user", "chat")).resolves.toMatchObject({ history: [{ role: "user", text: "RM300" }, { role: "user", text: "yesterday" }] });
  });

  it("splits a multi-intent message into an active draft plus a queue and advances on resolution", async () => {
    const multiExtraction = {
      actions: [
        { actionIndex: 1, capability: "transaction_capture" as const, transaction: sale, evidenceSummary: "sold nasi lemak", uncertainty: "none" as const, missingFields: [] },
        { actionIndex: 2, capability: "transaction_capture" as const, transaction: complete, evidenceSummary: "beli stok", uncertainty: "none" as const, missingFields: [] },
      ],
      globalAmbiguityNotes: [],
    };
    const directory = await mkdtemp(join(tmpdir(), "niagaai-input-batch-")); directories.push(directory);
    const repositories = createLocalTransactionRepositories(directory);
    const drafts = new TransactionDraftService(repositories.drafts, repositories.transactions);
    const conversations = new ConversationService(repositories.drafts, new LocalConversationStateRepository(directory));
    const processor = new TransactionInputProcessor({ drafts: repositories.drafts, draftService: drafts, conversations, apiKey: "key", model: "model", extractMultiIntent: vi.fn().mockResolvedValue(multiExtraction) as never });

    const first = await processor.process({ text: "sold nasi lemak RM25 cash and beli stok RM300 cash", sourceType: "telegram_text", telegramUserId: "user", telegramChatId: "chat" });
    expect(first).toMatchObject({ outcome: "draft", draft: { description: "Sale of nasi lemak" }, batch: { index: 1, total: 2 } });
    await expect(conversations.getActive("user", "chat")).resolves.toMatchObject({ batchIndex: 1, batchSize: 2, queuedActions: [{ extraction: { description: "Shop inventory" } }] });

    const next = await processor.advanceBatch({ telegramUserId: "user", telegramChatId: "chat" });
    expect(next).toMatchObject({ outcome: "draft", draft: { description: "Shop inventory" }, batch: { index: 2, total: 2 } });
    await expect(conversations.getActive("user", "chat")).resolves.toMatchObject({ batchIndex: 2, batchSize: 2, queuedActions: [] });

    await expect(processor.advanceBatch({ telegramUserId: "user", telegramChatId: "chat" })).resolves.toBeNull();
  });

  it("treats a single-intent multi-intent result as one draft without batch metadata", async () => {
    const singleExtraction = { actions: [{ actionIndex: 1, capability: "transaction_capture" as const, transaction: complete, evidenceSummary: "beli stok", uncertainty: "none" as const, missingFields: [] }], globalAmbiguityNotes: [] };
    const directory = await mkdtemp(join(tmpdir(), "niagaai-input-single-")); directories.push(directory);
    const repositories = createLocalTransactionRepositories(directory);
    const drafts = new TransactionDraftService(repositories.drafts, repositories.transactions);
    const solo = new TransactionInputProcessor({ drafts: repositories.drafts, draftService: drafts, conversations: new ConversationService(repositories.drafts, new LocalConversationStateRepository(directory)), apiKey: "key", model: "model", extractMultiIntent: vi.fn().mockResolvedValue(singleExtraction) as never });

    const result = await solo.process({ text: "beli stok RM300 cash", sourceType: "telegram_text", telegramUserId: "user", telegramChatId: "chat" });
    expect(result).toMatchObject({ outcome: "draft" });
    expect(result).not.toHaveProperty("batch");
    await expect(solo.advanceBatch({ telegramUserId: "user", telegramChatId: "chat" })).resolves.toBeNull();
  });

  it("clears an expired workflow and starts a fresh draft from the current message", async () => {
    let currentTime = new Date("2026-07-15T00:00:00.000Z");
    const now = () => currentTime;
    const directory = await mkdtemp(join(tmpdir(), "niagaai-input-expired-")); directories.push(directory);
    const repositories = createLocalTransactionRepositories(directory);
    const drafts = new TransactionDraftService(repositories.drafts, repositories.transactions, now);
    const conversations = new ConversationService(repositories.drafts, new LocalConversationStateRepository(directory), now);
    const extract = vi.fn().mockResolvedValue(complete);
    const processor = new TransactionInputProcessor({ drafts: repositories.drafts, draftService: drafts, conversations, apiKey: "key", model: "model", extract: extract as never, reextract: vi.fn().mockResolvedValue(complete) as never });
    const draft = await drafts.createDraft({ extraction: complete, telegramUserId: "user", telegramChatId: "chat", originalInput: "Bought stock" });
    await conversations.beginReview(draft);
    currentTime = new Date("2026-07-15T01:00:00.000Z");

    await expect(processor.process({ text: "Sold cakes RM500", sourceType: "telegram_text", telegramUserId: "user", telegramChatId: "chat" })).resolves.toMatchObject({ outcome: "draft", restarted: true, draft: { status: "pending", originalInput: "Sold cakes RM500" } });
    await expect(conversations.getActive("user", "chat")).resolves.toMatchObject({ mode: "awaiting_review", workflowStatus: "awaiting_confirmation" });
    await expect(repositories.drafts.findById(draft.id)).resolves.toMatchObject({ status: "cancelled" });
    expect(extract).toHaveBeenCalledOnce();
  });
});
