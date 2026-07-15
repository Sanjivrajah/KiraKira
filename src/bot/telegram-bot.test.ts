import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDuplicateSaveCallbackData, createTelegramBot, parseTransactionCallback } from "@/bot/telegram-bot";
import { getHomeAction, homeKeyboard } from "@/bot/keyboards/home-keyboard";
import { clarificationKeyboard, correctionKeyboard, replacementKeyboard, reviewKeyboard } from "@/bot/keyboards/transaction-keyboards";
import { formatDraft, messages } from "@/bot/messages";
import { LocalUserPreferenceRepository } from "@/bot/user-preferences";
import type { BotEnvironment } from "@/lib/env";
import type { Update } from "grammy/types";
import { TransactionDraftService } from "@/features/transaction-agent/transaction-confirmation";
import { createLocalTransactionRepositories } from "@/features/transaction-agent/transaction-repositories";
import type { TransactionExtraction } from "@/features/transaction-agent/transaction.schema";

const directories: string[] = [];
afterEach(async () => { vi.unstubAllGlobals(); await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

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

const complete: TransactionExtraction = { type: "expense", amount: 20, currency: "MYR", description: "Shop supplies", merchantOrCustomer: "Kedai Ali", paymentMethod: "cash", transactionDate: "2026-07-15", category: null, quantity: null, unit: null, missingFields: [], confidence: 0.9 };

describe("duplicate confirmation callback data", () => {
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
    const keyboards = [reviewKeyboard(id, "ms", true), clarificationKeyboard("paymentMethod", id, "ms"), clarificationKeyboard("type", id, "ms"), clarificationKeyboard("transactionDate", id, "ms"), correctionKeyboard(id, "ms"), replacementKeyboard(id, "ms")];
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
