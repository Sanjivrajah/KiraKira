import { Bot, type Context } from "grammy";
import { messages, interfaceText, clarificationMessage, formatDraft, type BotLocale } from "@/bot/messages";
import { getHomeAction, homeKeyboard } from "@/bot/keyboards/home-keyboard";
import { clarificationKeyboard, correctionKeyboard, duplicateKeyboard, replacementKeyboard, reviewKeyboard, settingsKeyboard, undoKeyboard } from "@/bot/keyboards/transaction-keyboards";
import { LocalUserPreferenceRepository, type UserPreferenceRepository } from "@/bot/user-preferences";
import { TransactionDraftService, type DraftAction } from "@/features/transaction-agent/transaction-confirmation";
import { createLocalTransactionRepositories } from "@/features/transaction-agent/transaction-repositories";
import { LocalConversationStateRepository } from "@/features/transaction-agent/conversation-repository";
import { ConversationService } from "@/features/transaction-agent/conversation-service";
import type { ConversationRequestedField } from "@/features/transaction-agent/conversation-state";
import { getRequiredMissingFields } from "@/features/transaction-agent/clarification";
import { TransactionInputProcessor, type TransactionInput, type TransactionInputResult } from "@/features/transaction-agent/transaction-input-processor";
import { downloadTelegramAudio, TelegramVoiceFileTooLargeError, type DownloadedTelegramAudio } from "@/lib/telegram/download-file";
import { ElevenLabsTranscriptionService, type AudioTranscription } from "@/lib/elevenlabs/transcription";
import type { BotEnvironment } from "@/lib/env";
import { MAX_TEXT_MESSAGE_LENGTH, MAX_TRANSACTIONS_RETURNED } from "@/features/transaction-agent/agent-config";
import { formatRecentTransactions, formatTransactionSummary, splitTelegramMessage } from "@/features/transaction-agent/telegram-command-formatters";

type VoiceDependencies = {
  downloadAudio?: (input: Parameters<typeof downloadTelegramAudio>[0]) => Promise<DownloadedTelegramAudio>;
  transcribeAudio?: (input: { filePath: string; filename: string; mediaType: string }) => Promise<AudioTranscription>;
  preferences?: UserPreferenceRepository;
  now?: () => Date;
  inputProcessor?: Pick<TransactionInputProcessor, "process">;
  telegramFetch?: typeof fetch;
};

type TransactionCallback = { action: DraftAction | "correct" | "transcript" | "undo" | "keep" | "replace" | "drop_new" | `answer.${string}` | `field.${string}`; draftId: string };

export function createDuplicateSaveCallbackData(draftId: string): string { return `tx:save_anyway:${draftId}`; }

export function parseTransactionCallback(data: string | undefined): TransactionCallback | null {
  const match = data?.match(/^tx:(confirm|correct|cancel|save_anyway|transcript|undo|keep|replace|drop_new|answer\.[a-z_]+|field\.[a-zA-Z_]+):([0-9a-f-]{36})$/i);
  return match ? { action: match[1] as TransactionCallback["action"], draftId: match[2] } : null;
}

function callbackAnswer(action: string, locale: BotLocale, now: Date): string | null {
  const value = action.slice("answer.".length);
  const date = (offset: number) => {
    const result = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
    const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Kuala_Lumpur" }).formatToParts(result);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
    return `${part("year")}-${part("month")}-${part("day")}`;
  };
  return ({
    cash: locale === "ms" ? "Tunai" : "Cash", bank_transfer: locale === "ms" ? "Pindahan bank" : "Bank transfer", card: locale === "ms" ? "Kad" : "Card", ewallet: "E-wallet", credit: locale === "ms" ? "Kredit" : "Credit",
    income: locale === "ms" ? "Wang masuk" : "Money in", expense: locale === "ms" ? "Wang keluar" : "Money out", customer_payment: locale === "ms" ? "Bayaran pelanggan" : "Customer payment",
    today: date(0), yesterday: date(-1),
  } as Record<string, string>)[value] ?? null;
}

export function createTelegramBot(environment: BotEnvironment, draftService?: TransactionDraftService, voiceDependencies: VoiceDependencies = {}): Bot {
  const { TELEGRAM_BOT_TOKEN, OPENAI_API_KEY, OPENAI_TRANSACTION_MODEL, ELEVENLABS_API_KEY, ELEVENLABS_STT_MODEL, MAX_VOICE_FILE_BYTES, LOCAL_DATA_DIRECTORY } = environment;
  const bot = new Bot(TELEGRAM_BOT_TOKEN, voiceDependencies.telegramFetch ? { client: { fetch: voiceDependencies.telegramFetch } } : undefined);
  const repositories = createLocalTransactionRepositories(LOCAL_DATA_DIRECTORY);
  const service = draftService ?? new TransactionDraftService(repositories.drafts, repositories.transactions, voiceDependencies.now);
  const conversations = new ConversationService(repositories.drafts, new LocalConversationStateRepository(LOCAL_DATA_DIRECTORY), voiceDependencies.now);
  const preferences = voiceDependencies.preferences ?? new LocalUserPreferenceRepository(LOCAL_DATA_DIRECTORY, voiceDependencies.now);
  const inputProcessor = voiceDependencies.inputProcessor ?? new TransactionInputProcessor({ drafts: repositories.drafts, draftService: service, conversations, apiKey: OPENAI_API_KEY, model: OPENAI_TRANSACTION_MODEL });
  const elevenLabs = new ElevenLabsTranscriptionService({ apiKey: ELEVENLABS_API_KEY, model: ELEVENLABS_STT_MODEL });
  const now = voiceDependencies.now ?? (() => new Date());

  const localeFor = (context: Context) => preferences.get(String(context.from?.id ?? ""));
  const replyHome = async (context: Context, text: string, locale: BotLocale) => context.reply(text, { reply_markup: homeKeyboard(locale) });
  const clearKeyboard = async (context: Context) => {
    try { await context.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } }); }
    catch (error) { console.warn("Unable to clear Telegram transaction buttons.", error instanceof Error ? error.message : "Unknown error"); }
  };
  const clearConversation = async (draftId: string) => {
    try { await conversations.clearByDraftId(draftId); }
    catch (error) { console.warn("Unable to clear Telegram conversation state.", error instanceof Error ? error.message : "Unknown error"); }
  };
  const clearStoredKeyboard = async (context: Context, inlineMessageId: number | undefined) => {
    if (!inlineMessageId || !context.chat) return;
    try { await context.api.editMessageReplyMarkup(context.chat.id, inlineMessageId, { reply_markup: { inline_keyboard: [] } }); }
    catch (error) { console.warn("Unable to clear stored Telegram transaction buttons.", error instanceof Error ? error.message : "Unknown error"); }
  };
  const attachKeyboard = async (context: Context, message: Awaited<ReturnType<typeof context.reply>>) => {
    if (context.from && context.chat) await conversations.attachInlineMessage(String(context.from.id), String(context.chat.id), message.message_id);
    return message;
  };
  const replyParts = async (context: Context, message: string) => { for (const part of splitTelegramMessage(message)) await context.reply(part); };

  bot.command("start", async (context) => { const locale = await localeFor(context); return replyHome(context, messages(locale).start, locale); });
  bot.command("help", async (context) => { const locale = await localeFor(context); return replyHome(context, messages(locale).help, locale); });
  bot.command("settings", async (context) => context.reply(messages(await localeFor(context)).settings, { reply_markup: settingsKeyboard() }));

  async function showRecent(context: Context) {
    if (!context.from) return;
    const locale = await localeFor(context);
    try { return replyParts(context, formatRecentTransactions(await repositories.transactions.findRecentByUser(String(context.from.id), MAX_TRANSACTIONS_RETURNED), undefined, locale)); }
    catch (error) { console.error("Unable to load Telegram transactions.", error instanceof Error ? error.message : "Unknown error"); return context.reply(interfaceText(locale).loadTransactionsFailed); }
  }
  async function showSummary(context: Context) {
    if (!context.from) return;
    const locale = await localeFor(context);
    try { return replyParts(context, formatTransactionSummary((await repositories.transactions.listByUser(String(context.from.id))).filter((item) => item.status === "confirmed"), locale)); }
    catch (error) { console.error("Unable to load Telegram transaction summary.", error instanceof Error ? error.message : "Unknown error"); return context.reply(interfaceText(locale).loadSummaryFailed); }
  }
  bot.command("transactions", showRecent);
  bot.command("summary", showSummary);

  async function presentResult(context: Context, result: TransactionInputResult, locale: BotLocale) {
    const text = interfaceText(locale);
    if (result.outcome === "unavailable") {
      const state = context.from ? await conversations.getActive(String(context.from.id), String(context.chat?.id)) : null;
      const draft = state ? await repositories.drafts.findById(state.draftId) : null;
      if (state?.mode === "awaiting_replacement" && draft) {
        await clearStoredKeyboard(context, state.inlineMessageId);
        return attachKeyboard(context, await context.reply(text.replacementPrompt, { reply_markup: replacementKeyboard(draft.id, locale) }));
      }
      return context.reply(text.unavailable);
    }
    if (result.restarted) await context.reply(text.restarted);
    if (result.outcome === "clarification") {
      const remaining = getRequiredMissingFields(result.draft).length;
      return attachKeyboard(context, await context.reply(clarificationMessage(locale, result.draft, result.requestedField, remaining), { reply_markup: clarificationKeyboard(result.requestedField, result.draft.id, locale) }));
    }
    return attachKeyboard(context, await context.reply(formatDraft(result.draft, locale), { reply_markup: reviewKeyboard(result.draft.id, locale, Boolean(result.draft.transcript)) }));
  }

  async function processTransactionInput(context: Context, input: Omit<TransactionInput, "telegramUserId" | "telegramChatId">, locale: BotLocale) {
    if (!context.from || !context.chat) return;
    if (input.text.length > MAX_TEXT_MESSAGE_LENGTH) return context.reply(interfaceText(locale).tooLong);
    const priorState = await conversations.getActive(String(context.from.id), String(context.chat.id));
    const result = await inputProcessor.process({ ...input, telegramUserId: String(context.from.id), telegramChatId: String(context.chat.id) });
    if (result.outcome !== "unavailable" && result.restarted) await clearStoredKeyboard(context, priorState?.inlineMessageId);
    return presentResult(context, result, locale);
  }

  async function cancelActive(context: Context) {
    if (!context.from || !context.chat) return;
    const locale = await localeFor(context);
    const text = interfaceText(locale);
    try {
      const state = await conversations.getActive(String(context.from.id), String(context.chat.id));
      if (!state) return context.reply(text.noActive);
      await service.act({ action: "cancel", draftId: state.draftId, telegramUserId: String(context.from.id) });
      await clearStoredKeyboard(context, state.inlineMessageId);
      await conversations.clearByUser(String(context.from.id), String(context.chat.id));
      return context.reply(text.cancelled);
    } catch (error) { console.error("Unable to cancel Telegram transaction flow.", error instanceof Error ? error.message : "Unknown error"); return context.reply(text.cancelFailed); }
  }
  bot.command("cancel", cancelActive);

  bot.on("message:text", async (context) => {
    const text = context.message.text;
    if (text.trim().startsWith("/")) return;
    const locale = await localeFor(context);
    const action = getHomeAction(text);
    if (action === "record") return context.reply(messages(locale).record);
    if (action === "recent") return showRecent(context);
    if (action === "summary") return showSummary(context);
    if (action === "help") return replyHome(context, messages(locale).help, locale);
    let status: Awaited<ReturnType<typeof context.reply>> | undefined;
    try {
      await context.api.sendChatAction(context.chat.id, "typing");
      status = await context.reply(messages(locale).preparing);
      return await processTransactionInput(context, { text, sourceType: "telegram_text" }, locale);
    } catch (error) { console.error("Telegram transaction extraction failed.", error instanceof Error ? error.message : "Unknown error"); return context.reply(interfaceText(locale).prepareFailed); }
    finally { if (status) await context.api.deleteMessage(context.chat.id, status.message_id).catch(() => undefined); }
  });

  bot.on("message:voice", async (context) => {
    const locale = await localeFor(context);
    const voice = context.message.voice;
    let audio: DownloadedTelegramAudio | undefined;
    let status: Awaited<ReturnType<typeof context.reply>> | undefined;
    try {
      await context.api.sendChatAction(context.chat.id, "record_voice");
      status = await context.reply(messages(locale).listening);
      audio = await (voiceDependencies.downloadAudio ?? downloadTelegramAudio)({ api: context.api, botToken: TELEGRAM_BOT_TOKEN, fileId: voice.file_id, fileSize: voice.file_size, maxBytes: MAX_VOICE_FILE_BYTES });
      const transcription = await (voiceDependencies.transcribeAudio ?? ((input) => elevenLabs.transcribeAudio(input)))({ filePath: audio.filePath, filename: audio.filename, mediaType: audio.mediaType });
      await context.api.sendChatAction(context.chat.id, "typing");
      return await processTransactionInput(context, { text: transcription.text, sourceType: "telegram_voice", transcript: transcription.text, telegramFileId: voice.file_id }, locale);
    } catch (error) {
      console.error("Telegram voice-note processing failed.", error instanceof Error ? error.message : "Unknown error");
      if (error instanceof TelegramVoiceFileTooLargeError) return context.reply(interfaceText(locale).voiceTooLarge(Math.floor(MAX_VOICE_FILE_BYTES / (1024 * 1024))));
      return context.reply(interfaceText(locale).voiceFailed);
    } finally {
      if (status) await context.api.deleteMessage(context.chat.id, status.message_id).catch(() => undefined);
      if (audio) await audio.cleanup().catch(() => console.warn("Temporary Telegram voice file cleanup failed."));
    }
  });

  bot.on("message", async (context) => {
    if (!("sticker" in context.message || "video" in context.message || "contact" in context.message || "location" in context.message || "photo" in context.message || "document" in context.message || "audio" in context.message)) return;
    const locale = await localeFor(context);
    return context.reply(interfaceText(locale).unsupported);
  });

  bot.on("callback_query:data", async (context) => {
    try { await context.answerCallbackQuery(); } catch (error) { console.warn("Unable to acknowledge Telegram callback.", error instanceof Error ? error.message : "Unknown error"); }
    const localeMatch = context.callbackQuery.data.match(/^locale:(en|ms)$/);
    if (localeMatch) {
      const locale = localeMatch[1] as BotLocale;
      await preferences.set(String(context.from.id), locale);
      await clearKeyboard(context);
      return replyHome(context, messages(locale).localeSaved, locale);
    }
    const callback = parseTransactionCallback(context.callbackQuery.data);
    if (!callback) { const locale = await localeFor(context); await clearKeyboard(context); return context.reply(interfaceText(locale).staleAction); }
    const locale = await localeFor(context);
    const text = interfaceText(locale);
    const userId = String(context.from.id);
    const chatId = String(context.chat?.id ?? "");
    const draft = await repositories.drafts.findById(callback.draftId);
    if (!draft) { await clearKeyboard(context); await clearConversation(callback.draftId); return context.reply(text.missingDraft); }
    if (draft.telegramUserId !== userId || draft.telegramChatId !== chatId) { await clearKeyboard(context); return context.reply(text.foreignAction); }

    if (callback.action === "transcript") return replyParts(context, `${text.transcriptTitle}\n\n${draft.transcript ?? text.noTranscript}`);
    if (callback.action === "undo") {
      const outcome = await service.undo({ transactionId: callback.draftId, telegramUserId: userId, telegramChatId: chatId });
      await clearKeyboard(context);
      const outcomeText = outcome === "voided" ? text.undoVoided : outcome === "expired" ? text.undoExpired : outcome === "already_voided" ? text.undoRepeated : text.undoUnavailable;
      return context.reply(outcomeText);
    }
    if (callback.action === "keep" || callback.action === "drop_new") {
      await conversations.continueReview(draft);
      await clearKeyboard(context);
      return attachKeyboard(context, await context.reply(formatDraft(draft, locale), { reply_markup: reviewKeyboard(draft.id, locale, Boolean(draft.transcript)) }));
    }
    if (callback.action === "replace") {
      const state = await conversations.getActive(userId, chatId);
      if (state?.mode !== "awaiting_replacement" || !state.replacementInput) { await clearKeyboard(context); return context.reply(text.newRequestExpired); }
      const replacement = state.replacementInput;
      await service.act({ action: "cancel", draftId: draft.id, telegramUserId: userId });
      await conversations.clearByUser(userId, chatId);
      await clearKeyboard(context);
      try { return await processTransactionInput(context, replacement, locale); }
      catch (error) { console.error("Replacement transaction extraction failed.", error instanceof Error ? error.message : "Unknown error"); return context.reply(text.replacementFailed); }
    }
    if (callback.action.startsWith("field.")) {
      const field = callback.action.slice("field.".length);
      await clearKeyboard(context);
      if (field === "other") { await conversations.beginCorrection(draft); return attachKeyboard(context, await context.reply(text.freeCorrection, { reply_markup: clarificationKeyboard("purpose", draft.id, locale) })); }
      const validFields: ConversationRequestedField[] = ["amount", "purpose", "merchantOrCustomer", "transactionDate", "paymentMethod"];
      if (!validFields.includes(field as ConversationRequestedField)) return context.reply(text.staleAction);
      await conversations.beginCorrectionField(draft, field as ConversationRequestedField);
      return attachKeyboard(context, await context.reply(clarificationMessage(locale, draft, field as ConversationRequestedField, 1), { reply_markup: clarificationKeyboard(field as ConversationRequestedField, draft.id, locale) }));
    }
    if (callback.action.startsWith("answer.")) {
      if (callback.action === "answer.other_date") { await clearKeyboard(context); return attachKeyboard(context, await context.reply(text.datePrompt, { reply_markup: clarificationKeyboard("transactionDate", draft.id, locale) })); }
      const answer = callbackAnswer(callback.action, locale, now());
      if (!answer) { await clearKeyboard(context); return context.reply(text.staleAction); }
      await clearKeyboard(context);
      try { return await processTransactionInput(context, { text: answer, sourceType: "telegram_text" }, locale); }
      catch (error) { console.error("Telegram quick answer failed.", error instanceof Error ? error.message : "Unknown error"); return context.reply(text.quickAnswerFailed); }
    }
    if (callback.action === "correct") {
      await conversations.beginCorrection(draft);
      await clearKeyboard(context);
      return attachKeyboard(context, await context.reply(text.correctionPrompt, { reply_markup: correctionKeyboard(draft.id, locale) }));
    }

    let result;
    try { result = await service.act({ action: callback.action as DraftAction, draftId: callback.draftId, telegramUserId: userId }); }
    catch (error) { console.error("Unable to process Telegram transaction action.", error instanceof Error ? error.message : "Unknown error"); return context.reply(text.actionFailed); }
    if (result.outcome === "duplicate") { await clearKeyboard(context); return attachKeyboard(context, await context.reply(`${text.duplicateIntro}\n\n${formatDraft(result.transaction, locale)}`, { reply_markup: duplicateKeyboard(result.draft.id, locale) })); }
    await clearKeyboard(context);
    if (result.outcome === "missing" || result.outcome === "expired") { await clearConversation(callback.draftId); return context.reply(text.expiredDraft); }
    if (result.outcome === "not_owner") return context.reply(text.foreignDraft);
    if (result.outcome === "incomplete") return context.reply(text.incomplete);
    if (result.outcome === "cancelled") { await clearConversation(callback.draftId); return context.reply(text.cancelled); }
    if (result.outcome === "confirmed") { await clearConversation(callback.draftId); return context.reply(`${messages(locale).saved(result.transaction.type)}\n\n${formatDraft(result.transaction, locale)}`, { reply_markup: undoKeyboard(result.transaction.id, locale) }); }
    return context.reply(text.staleAction);
  });

  return bot;
}
