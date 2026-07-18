import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDuplicateSaveCallbackData, createTelegramBot, isNoopTelegramMarkupEdit, parseTransactionCallback } from "@/bot/telegram-bot";
import { getHomeAction, homeKeyboard } from "@/bot/keyboards/home-keyboard";
import { clarificationKeyboard, correctionKeyboard, paymentSettingsKeyboard, replacementKeyboard, reviewKeyboard, settingsKeyboard, timezoneSettingsKeyboard } from "@/bot/keyboards/transaction-keyboards";
import { formatDraft, messages } from "@/bot/messages";
import { LocalUserPreferenceRepository } from "@/bot/user-preferences";
import type { BotEnvironment } from "@/lib/env";
import type { Update } from "grammy/types";
import { TransactionDraftService } from "@/features/transaction-agent/transaction-confirmation";
import { createLocalTransactionRepositories } from "@/features/transaction-agent/transaction-repositories";
import { ConversationService } from "@/features/transaction-agent/conversation-service";
import { LocalConversationStateRepository } from "@/features/transaction-agent/conversation-repository";
import { TransactionInputProcessor } from "@/features/transaction-agent/transaction-input-processor";
import type { TransactionExtraction } from "@/features/transaction-agent/transaction.schema";
import type { ReceiptExtraction } from "@/lib/openai/receipt-schema";
import { TelegramReceiptFileTooLargeError } from "@/lib/telegram/download-receipt";

const directories: string[] = [];
afterEach(async () => { vi.unstubAllGlobals(); vi.restoreAllMocks(); await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

const environment = (directory: string): BotEnvironment => ({ TELEGRAM_BOT_TOKEN: "123456:test-token", OPENAI_API_KEY: "test", OPENAI_TRANSACTION_MODEL: "test", ELEVENLABS_API_KEY: "test", ELEVENLABS_STT_MODEL: "test", MAX_VOICE_FILE_BYTES: 20 * 1024 * 1024, LOCAL_DATA_DIRECTORY: directory });

function telegramFetch() {
  const calls: { method: string; body: string }[] = [];
  let messageId = 10;
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = url.split("/").at(-1) ?? "";
    const body = typeof init?.body === "string" ? init.body : "";
    calls.push({ method, body });
    const messageResult = { message_id: messageId++, date: 1, chat: { id: 99, type: "private" }, text: "ok" };
    return new Response(JSON.stringify({ ok: true, result: method === "sendMessage" || method === "editMessageReplyMarkup" ? messageResult : true }), { headers: { "content-type": "application/json" } });
  });
  return { calls, fetchMock };
}

function update(text: string, updateId = 1): Update {
  return { update_id: updateId, message: { message_id: updateId, date: 1, text, ...(text.startsWith("/") ? { entities: [{ type: "bot_command", offset: 0, length: text.length }] } : {}), from: { id: 7, is_bot: false, first_name: "Owner" }, chat: { id: 99, type: "private", first_name: "Owner" } } };
}

const botInfo = { id: 123456, is_bot: true as const, first_name: "NiagaAI", username: "niaga_test_bot", can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false, has_topics_enabled: false, allows_users_to_create_topics: false, can_manage_bots: false, supports_join_request_queries: false };

function callbackUpdate(data: string, fromId = 7, updateId = 20): Update {
  return {
    update_id: updateId,
    callback_query: {
      id: `callback-${updateId}`,
      chat_instance: "test",
      data,
      from: { id: fromId, is_bot: false, first_name: "Owner" },
      message: { message_id: 50, date: 1, text: "Draft", from: botInfo, chat: { id: 99, type: "private", first_name: "Owner" } },
    },
  };
}

function photoUpdate(updateId = 40): Update {
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: 1,
      from: { id: 7, is_bot: false, first_name: "Owner" },
      chat: { id: 99, type: "private", first_name: "Owner" },
      caption: "Lunch supplies receipt",
      photo: [{ file_id: "small-photo", file_unique_id: "small", width: 100, height: 100, file_size: 100 }, { file_id: "large-photo", file_unique_id: "large", width: 1000, height: 1000, file_size: 500 }],
    },
  };
}

function documentUpdate(updateId = 41): Update {
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: 1,
      from: { id: 7, is_bot: false, first_name: "Owner" },
      chat: { id: 99, type: "private", first_name: "Owner" },
      document: { file_id: "receipt-document", file_unique_id: "document", file_name: "receipt.pdf", mime_type: "application/pdf", file_size: 500 },
    },
  };
}

const complete: TransactionExtraction = { type: "expense", amount: 20, currency: "MYR", description: "Shop supplies", merchantOrCustomer: "Kedai Ali", paymentMethod: "cash", transactionDate: "2026-07-15", category: null, quantity: null, unit: null, missingFields: [], confidence: 0.9 };
const receiptExtraction: ReceiptExtraction = {
  documentType: "receipt",
  merchantName: { value: "Kedai Ali", evidenceText: "Kedai Ali", confidence: 0.9 },
  invoiceNumber: { value: null, evidenceText: null, confidence: 0 },
  documentDate: { value: "2026-07-16", evidenceText: "16/07/2026", confidence: 0.9 },
  currency: { value: "MYR", evidenceText: "RM", confidence: 0.9 },
  lineItems: [{ description: "Shop supplies", quantity: 1, unitPrice: 20, amount: 20, evidenceText: "Shop supplies RM20", confidence: 0.9 }],
  subtotal: { value: 20, evidenceText: "Subtotal RM20", confidence: 0.9 },
  tax: { value: 0, evidenceText: "Tax RM0", confidence: 0.9 },
  total: { value: 20, evidenceText: "Total RM20", confidence: 0.9 },
  paymentMethod: { value: "Cash", evidenceText: "Cash", confidence: 0.9 },
  category: { value: "Supplies", evidenceText: "Shop supplies", confidence: 0.8 },
  missingFields: [], warnings: [], overallConfidence: 0.9,
};

describe("multi-intent capture end to end", () => {
  it("splits one message into a batch, shows an e-invoice hint, and advances the queue on confirm", async () => {
    const directory = await mkdtemp(join(tmpdir(), "niagaai-bot-batch-")); directories.push(directory);
    const { calls, fetchMock } = telegramFetch();
    const repositories = createLocalTransactionRepositories(directory);
    const service = new TransactionDraftService(repositories.drafts, repositories.transactions);
    const conversations = new ConversationService(repositories.drafts, new LocalConversationStateRepository(directory));
    const sale: TransactionExtraction = { type: "income", amount: 25, currency: "MYR", description: "Sale of nasi lemak", merchantOrCustomer: "Ahmad", paymentMethod: "cash", transactionDate: "2026-07-15", category: "Sales revenue", quantity: null, unit: null, missingFields: [], confidence: 0.9 };
    const extractMultiIntent = vi.fn().mockResolvedValue({
      actions: [
        { actionIndex: 1, capability: "transaction_capture", transaction: sale, evidenceSummary: "sold nasi lemak", uncertainty: "none", missingFields: [] },
        { actionIndex: 2, capability: "transaction_capture", transaction: complete, evidenceSummary: "beli stok", uncertainty: "none", missingFields: [] },
      ],
      globalAmbiguityNotes: [],
    });
    const inputProcessor = new TransactionInputProcessor({ drafts: repositories.drafts, draftService: service, conversations, apiKey: "k", model: "m", extractMultiIntent: extractMultiIntent as never });
    const bot = createTelegramBot(environment(directory), service, { inputProcessor, telegramFetch: fetchMock as typeof fetch });
    bot.botInfo = botInfo;

    await bot.handleUpdate(update("sold nasi lemak RM25 cash and beli stok RM20 cash", 80));

    const bodies = calls.filter((call) => call.method === "sendMessage").map((call) => call.body);
    expect(bodies.some((body) => body.includes("I caught 2 transactions"))).toBe(true);
    expect(bodies.some((body) => body.includes("MyInvois e-Invoice"))).toBe(true);
    const confirmMatch = bodies.join("").match(/tx:confirm:([0-9a-f-]{36})/);
    expect(confirmMatch).not.toBeNull();

    await bot.handleUpdate(callbackUpdate(`tx:confirm:${confirmMatch![1]}`, 7, 81));

    const afterConfirm = calls.filter((call) => call.method === "sendMessage").map((call) => call.body);
    expect(afterConfirm.some((body) => body.includes("Next — transaction 2 of 2"))).toBe(true);
    await expect(repositories.transactions.listByUser("7")).resolves.toHaveLength(1);
  });
});

describe("duplicate confirmation callback data", () => {
  it("treats Telegram's already-cleared keyboard response as a harmless no-op", () => {
    expect(isNoopTelegramMarkupEdit(new Error("400: Bad Request: message is not modified"))).toBe(true);
    expect(isNoopTelegramMarkupEdit(new Error("network unavailable"))).toBe(false);
  });

  it("stays within Telegram's 64-byte callback-data limit", () => {
    const callbackData = createDuplicateSaveCallbackData("00000000-0000-4000-8000-000000000000");
    expect(Buffer.byteLength(callbackData, "utf8")).toBeLessThanOrEqual(64);
    expect(callbackData).toBe("tx:save_anyway:00000000-0000-4000-8000-000000000000");
  });

  it("rejects malformed callback data and parses supported actions", () => {
    expect(parseTransactionCallback("bad")).toBeNull();
    expect(parseTransactionCallback("tx:field.paymentMethod:00000000-0000-4000-8000-000000000000")).toEqual({ action: "field.paymentMethod", draftId: "00000000-0000-4000-8000-000000000000" });
  });
});

describe("Stage 1 presentation", () => {
  it("keeps every generated callback within Telegram's byte limit", () => {
    const id = "00000000-0000-4000-8000-000000000000";
    const keyboards = [reviewKeyboard(id, "ms", true), clarificationKeyboard("paymentMethod", id, "ms"), clarificationKeyboard("type", id, "ms"), clarificationKeyboard("transactionDate", id, "ms"), correctionKeyboard(id, "ms"), replacementKeyboard(id, "ms"), settingsKeyboard(undefined, "ms"), timezoneSettingsKeyboard("ms"), paymentSettingsKeyboard("ms")];
    for (const keyboard of keyboards) for (const row of keyboard.inline_keyboard) for (const button of row) expect(Buffer.byteLength(button.callback_data, "utf8")).toBeLessThanOrEqual(64);
  });

  it("maps English and Bahasa Melayu home buttons without treating ordinary text as an action", () => {
    expect(getHomeAction(messages("en").home.record)).toBe("record");
    expect(getHomeAction(messages("ms").home.summary)).toBe("summary");
    expect(getHomeAction("Bought stock RM20")).toBeNull();
    expect(homeKeyboard("en").input_field_placeholder).toContain("voice note");
  });

  it("formats user text as plain content without technical confidence or storage details", () => {
    const formatted = formatDraft({ type: "expense", amount: 20, currency: "MYR", description: "Tea <b>& supplies", merchantOrCustomer: "A & B", paymentMethod: "cash", transactionDate: "2026-07-15", category: null, quantity: null, unit: null, confidence: 0.9 }, "en");
    expect(formatted).toContain("Tea <b>& supplies");
    expect(formatted).not.toContain("Confidence");
    expect(formatted).not.toContain("locally");
  });

  it("persists an explicit locale and defaults unmigrated users to English", async () => {
    const directory = await mkdtemp(join(tmpdir(), "niagaai-preferences-")); directories.push(directory);
    const preferences = new LocalUserPreferenceRepository(directory, () => new Date("2026-07-15T00:00:00.000Z"));
    await expect(preferences.get("new-user")).resolves.toBe("en");
    await preferences.set("new-user", "ms");
    await expect(new LocalUserPreferenceRepository(directory).get("new-user")).resolves.toBe("ms");
  });

  it("handles start, help, settings, and home quick actions without invoking extraction", async () => {
    const directory = await mkdtemp(join(tmpdir(), "niagaai-bot-")); directories.push(directory);
    const { calls, fetchMock } = telegramFetch();
    const process = vi.fn();
    const bot = createTelegramBot(environment(directory), undefined, { inputProcessor: { process }, telegramFetch: fetchMock as typeof fetch });
    bot.botInfo = botInfo;
    await bot.handleUpdate(update("/start", 1));
    await bot.handleUpdate(update("/help", 2));
    await bot.handleUpdate(update("/settings", 3));
    await bot.handleUpdate(update("Record transaction", 4));
    await bot.handleUpdate(update("Recent transactions", 5));
    await bot.handleUpdate(update("Summary", 6));
    expect(process).not.toHaveBeenCalled();
    expect(calls.filter((call) => call.method === "sendMessage")).toHaveLength(6);
    expect(calls.some((call) => call.body.includes("input_field_placeholder"))).toBe(true);
  });

  it("saves timezone and default payment settings and passes the default into new draft processing", async () => {
    const directory = await mkdtemp(join(tmpdir(), "niagaai-bot-settings-")); directories.push(directory);
    const { calls, fetchMock } = telegramFetch();
    const process = vi.fn().mockResolvedValue({ outcome: "unavailable" });
    const preferences = new LocalUserPreferenceRepository(directory, () => new Date("2026-07-15T00:00:00.000Z"));
    const bot = createTelegramBot(environment(directory), undefined, { inputProcessor: { process }, preferences, telegramFetch: fetchMock as typeof fetch });
    bot.botInfo = botInfo;

    await bot.handleUpdate(callbackUpdate("settings:timezone:utc", 7, 30));
    await bot.handleUpdate(callbackUpdate("settings:payment:bank_transfer", 7, 31));
    await bot.handleUpdate(update("Bought supplies RM20", 32));

    await expect(preferences.getSettings("7")).resolves.toMatchObject({ timezone: "UTC", defaultPaymentMethod: "bank_transfer" });
    expect(process).toHaveBeenCalledWith(expect.objectContaining({ defaultPaymentMethod: "bank_transfer" }));
    expect(calls.some((call) => call.body.includes("Default payment method saved"))).toBe(true);
  });

  it("sends and cleans up text processing feedback", async () => {
    const directory = await mkdtemp(join(tmpdir(), "niagaai-bot-feedback-")); directories.push(directory);
    const { calls, fetchMock } = telegramFetch();
    const process = vi.fn().mockResolvedValue({ outcome: "unavailable" });
    const bot = createTelegramBot(environment(directory), undefined, { inputProcessor: { process }, telegramFetch: fetchMock as typeof fetch });
    bot.botInfo = botInfo;
    await bot.handleUpdate(update("Bought stock RM20 cash today"));
    expect(process).toHaveBeenCalledOnce();
    expect(calls.map((call) => call.method)).toEqual(expect.arrayContaining(["sendChatAction", "sendMessage", "deleteMessage"]));
  });

  it("rate limits provider-heavy text before extraction and leaves no draft", async () => {
    const directory = await mkdtemp(join(tmpdir(), "niagaai-bot-rate-limit-")); directories.push(directory);
    const { calls, fetchMock } = telegramFetch();
    const process = vi.fn();
    const bot = createTelegramBot(environment(directory), undefined, {
      inputProcessor: { process },
      providerRateLimiter: { check: () => ({ allowed: false as const, retryAfterMs: 15_000 }) },
      telegramFetch: fetchMock as typeof fetch,
    });
    bot.botInfo = botInfo;
    await bot.handleUpdate(update("Bought stock RM20", 71));
    expect(process).not.toHaveBeenCalled();
    expect(calls.some((call) => call.body.includes("Too many requests"))).toBe(true);
  });

  it("turns the largest Telegram receipt photo into a reviewable draft and always cleans up the file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "niagaai-bot-receipt-")); directories.push(directory);
    const { calls, fetchMock } = telegramFetch();
    const cleanup = vi.fn().mockResolvedValue(undefined);
    const downloadReceipt = vi.fn().mockResolvedValue({ bytes: new Uint8Array([1, 2, 3]), filePath: "/tmp/receipt.png", filename: "receipt.png", mediaType: "image/png", cleanup });
    const extractReceipt = vi.fn().mockResolvedValue(receiptExtraction);
    const bot = createTelegramBot(environment(directory), undefined, { downloadReceipt, extractReceipt, telegramFetch: fetchMock as typeof fetch });
    bot.botInfo = botInfo;

    await bot.handleUpdate(photoUpdate());

    expect(downloadReceipt).toHaveBeenCalledWith(expect.objectContaining({ fileId: "large-photo", fileSize: 500 }));
    expect(extractReceipt).toHaveBeenCalledWith({ bytes: new Uint8Array([1, 2, 3]), mediaType: "image/png" });
    expect(cleanup).toHaveBeenCalledOnce();
    const drafts = JSON.parse(await readFile(join(directory, "transaction-drafts.json"), "utf8"));
    expect(drafts).toEqual([expect.objectContaining({ status: "pending", sourceType: "telegram_photo", telegramFileId: "large-photo", originalInput: "Lunch supplies receipt", amount: 20 })]);
    expect(calls.some((call) => call.body.includes("Was this money in"))).toBe(true);
  });

  it("gives an actionable size error for an oversized receipt document without extracting it", async () => {
    const directory = await mkdtemp(join(tmpdir(), "niagaai-bot-receipt-large-")); directories.push(directory);
    const { calls, fetchMock } = telegramFetch();
    const extractReceipt = vi.fn();
    const bot = createTelegramBot(environment(directory), undefined, { downloadReceipt: vi.fn().mockRejectedValue(new TelegramReceiptFileTooLargeError()), extractReceipt, telegramFetch: fetchMock as typeof fetch });
    bot.botInfo = botInfo;

    await bot.handleUpdate(documentUpdate());

    expect(extractReceipt).not.toHaveBeenCalled();
    expect(calls.some((call) => call.body.includes("under 10 MiB"))).toBe(true);
  });

  it("cleans up a downloaded receipt when extraction fails and creates no draft", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const directory = await mkdtemp(join(tmpdir(), "niagaai-bot-receipt-failure-")); directories.push(directory);
    const { calls, fetchMock } = telegramFetch();
    const cleanup = vi.fn().mockResolvedValue(undefined);
    const bot = createTelegramBot(environment(directory), undefined, {
      downloadReceipt: vi.fn().mockResolvedValue({ bytes: new Uint8Array([1]), filePath: "/tmp/receipt.jpg", filename: "receipt.jpg", mediaType: "image/jpeg", cleanup }),
      extractReceipt: vi.fn().mockRejectedValue(new Error("provider payload")),
      telegramFetch: fetchMock as typeof fetch,
    });
    bot.botInfo = botInfo;

    await bot.handleUpdate(photoUpdate(42));

    expect(cleanup).toHaveBeenCalledOnce();
    expect(calls.some((call) => call.body.includes("Nothing was saved"))).toBe(true);
    await expect(readFile(join(directory, "transaction-drafts.json"), "utf8")).rejects.toThrow();
  });

  it("acknowledges callbacks and removes keyboards for cancellation, repeat, malformed, and foreign-user outcomes", async () => {
    const directory = await mkdtemp(join(tmpdir(), "niagaai-bot-callbacks-")); directories.push(directory);
    const repositories = createLocalTransactionRepositories(directory);
    const service = new TransactionDraftService(repositories.drafts, repositories.transactions, () => new Date("2026-07-15T00:00:00.000Z"));
    const ownerDraft = await service.createDraft({ extraction: complete, telegramUserId: "7", telegramChatId: "99", originalInput: "supplies" });
    const foreignDraft = await service.createDraft({ extraction: complete, telegramUserId: "7", telegramChatId: "99", originalInput: "other supplies" });
    const { calls, fetchMock } = telegramFetch();
    const bot = createTelegramBot(environment(directory), service, { telegramFetch: fetchMock as typeof fetch });
    bot.botInfo = botInfo;

    await bot.handleUpdate(callbackUpdate(`tx:cancel:${ownerDraft.id}`, 7, 20));
    await bot.handleUpdate(callbackUpdate(`tx:cancel:${ownerDraft.id}`, 7, 21));
    await bot.handleUpdate(callbackUpdate("malformed", 7, 22));
    await bot.handleUpdate(callbackUpdate(`tx:confirm:${foreignDraft.id}`, 8, 23));

    expect(calls.filter((call) => call.method === "answerCallbackQuery")).toHaveLength(4);
    expect(calls.filter((call) => call.method === "editMessageReplyMarkup")).toHaveLength(4);
    await expect(repositories.drafts.findById(ownerDraft.id)).resolves.toMatchObject({ status: "cancelled" });
    await expect(repositories.drafts.findById(foreignDraft.id)).resolves.toMatchObject({ status: "pending" });
  });
});
