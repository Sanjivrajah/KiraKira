import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConversationService } from "@/features/transaction-agent/conversation-service";
import { LocalConversationStateRepository } from "@/features/transaction-agent/conversation-repository";
import { TransactionDraftService } from "@/features/transaction-agent/transaction-confirmation";
import { TransactionInputProcessor } from "@/features/transaction-agent/transaction-input-processor";
import { LocalOrchestrationRepository } from "@/features/transaction-agent/orchestration-repository";
import { assertOrchestrationTransition, safeOrchestrationErrorCode, TransactionOrchestrationService } from "@/features/transaction-agent/orchestration-service";
import { createLocalTransactionRepositories } from "@/features/transaction-agent/transaction-repositories";
import type { TransactionExtraction } from "@/features/transaction-agent/transaction.schema";

const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

const extraction: TransactionExtraction = { type: "expense", amount: 24.5, currency: "MYR", description: "Shop supplies", merchantOrCustomer: "Kedai Maju", paymentMethod: "cash", transactionDate: "2026-07-16", category: "Inventory", quantity: null, unit: null, missingFields: [], confidence: 0.9 };

async function setup() {
  const directory = await mkdtemp(join(tmpdir(), "niagaai-orchestration-")); directories.push(directory);
  const repositories = createLocalTransactionRepositories(directory);
  const drafts = new TransactionDraftService(repositories.drafts, repositories.transactions);
  const conversations = new ConversationService(repositories.drafts, new LocalConversationStateRepository(directory));
  const inputProcessor = new TransactionInputProcessor({ drafts: repositories.drafts, draftService: drafts, conversations, apiKey: "test", model: "test", extract: vi.fn().mockResolvedValue(extraction) as never });
  const orchestrationRepository = new LocalOrchestrationRepository(directory);
  const orchestration = new TransactionOrchestrationService(orchestrationRepository, () => new Date("2026-07-16T00:00:00.000Z"), { info: vi.fn() });
  const envelope = { updateId: "update-1", messageId: "message-1", telegramUserId: "owner", telegramChatId: "chat-a", inputKind: "text" as const, locale: "en" as const, normalizedText: "Paid RM24.50 for supplies", receivedAt: "2026-07-16T00:00:00.000Z" };
  return { repositories, inputProcessor, orchestrationRepository, orchestration, envelope };
}

describe("TransactionOrchestrationService", () => {
  it("creates a redacted run and traceable transaction-capture step", async () => {
    const { orchestration, orchestrationRepository, envelope } = await setup();
    const result = await orchestration.execute(envelope, async () => "draft-created");

    expect(result).toMatchObject({ outcome: "processed", run: { status: "completed", inputSummary: { characterCount: envelope.normalizedText.length, hasMedia: false }, routedIntent: "transaction_capture" } });
    if (result.outcome !== "processed") throw new Error("Expected a processed run.");
    await expect(orchestrationRepository.listSteps(result.run.id)).resolves.toMatchObject([{ stepKey: "transaction_capture", status: "completed" }]);
  });

  it("rejects invalid state transitions while allowing the active capture transition", () => {
    expect(() => assertOrchestrationTransition("routing", "completed")).not.toThrow();
    expect(() => assertOrchestrationTransition("completed", "routing")).toThrow("Invalid orchestration transition");
  });

  it("does not invoke the existing transaction adapter twice for a duplicate Telegram update", async () => {
    const { orchestration, inputProcessor, repositories, envelope } = await setup();
    const capture = () => inputProcessor.process({ text: envelope.normalizedText!, sourceType: "telegram_text", telegramUserId: envelope.telegramUserId, telegramChatId: envelope.telegramChatId });
    const first = await orchestration.execute(envelope, capture);
    const repeated = await orchestration.execute(envelope, capture);

    expect(first).toMatchObject({ outcome: "processed", value: { outcome: "draft" } });
    expect(repeated).toMatchObject({ outcome: "duplicate" });
    await expect(repositories.drafts.findById(first.outcome === "processed" && first.value.outcome === "draft" ? first.value.draft.id : "")).resolves.not.toBeNull();
    await expect(repositories.transactions.listByUser(envelope.telegramUserId)).resolves.toEqual([]);
  });

  it("maps provider failures without storing the provider message", async () => {
    const { orchestration, orchestrationRepository, envelope } = await setup();
    const result = await orchestration.execute(envelope, async () => { throw new Error("OpenAI extraction request timed out"); });

    expect(result).toMatchObject({ outcome: "failed", errorCode: "provider_unavailable", run: { failureCode: "provider_unavailable" } });
    if (result.outcome !== "failed") throw new Error("Expected failed orchestration.");
    await expect(orchestrationRepository.listSteps(result.run.id)).resolves.toMatchObject([{ status: "failed", errorCode: "provider_unavailable" }]);
    expect(safeOrchestrationErrorCode(new Error("unable to save JSON store"))).toBe("persistence_failed");
  });

  it("keeps runs isolated by Telegram user and chat", async () => {
    const { orchestration, orchestrationRepository, envelope } = await setup();
    const first = await orchestration.execute(envelope, async () => "one");
    const second = await orchestration.execute({ ...envelope, updateId: "update-2", messageId: "message-2", telegramChatId: "chat-b" }, async () => "two");

    if (first.outcome !== "processed" || second.outcome !== "processed") throw new Error("Expected both runs.");
    expect(first.run.telegramChatId).toBe("chat-a");
    expect(second.run.telegramChatId).toBe("chat-b");
    await expect(orchestrationRepository.findRunByIdempotencyKey("telegram:update-1:message-1:text")).resolves.toMatchObject({ telegramUserId: "owner", telegramChatId: "chat-a" });
  });
});
