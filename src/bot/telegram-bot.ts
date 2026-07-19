import { Bot, InputFile, type Context } from "grammy";
import { messages, helpMessage, interfaceText, clarificationMessage, formatDraft, settingsMessage, type BotLocale } from "@/bot/messages";
import { getHomeAction, homeKeyboard } from "@/bot/keyboards/home-keyboard";
import { clarificationKeyboard, correctionKeyboard, duplicateKeyboard, paymentSettingsKeyboard, replacementKeyboard, reviewKeyboard, settingsKeyboard, timezoneSettingsKeyboard, undoKeyboard } from "@/bot/keyboards/transaction-keyboards";
import { LocalUserPreferenceRepository, type UserPreferenceRepository } from "@/bot/user-preferences";
import { TransactionDraftService, type DraftAction } from "@/features/transaction-agent/transaction-confirmation";
import { createLocalTransactionRepositories, type DraftRepository, type TransactionRepository } from "@/features/transaction-agent/transaction-repositories";
import { SupabaseTelegramAccountResolver, SupabaseTelegramConversationRepository, SupabaseTelegramDraftRepository, SupabaseTelegramPreferenceRepository, SupabaseTelegramTransactionRepository, TelegramLinkRequiredError } from "@/features/transaction-agent/supabase-telegram-repositories";
import { LocalConversationStateRepository } from "@/features/transaction-agent/conversation-repository";
import { ConversationService } from "@/features/transaction-agent/conversation-service";
import { isConversationStateExpired, type ConversationRequestedField } from "@/features/transaction-agent/conversation-state";
import { getRequiredMissingFields } from "@/features/transaction-agent/clarification";
import { applyDefaultPaymentMethod, TransactionInputProcessor, type TransactionInput, type TransactionInputResult } from "@/features/transaction-agent/transaction-input-processor";
import { extractMultiIntentFromText } from "@/features/transaction-agent/multi-intent-extractor";
import { hasMultipleReceiptTransactions, receiptToTransactionExtraction } from "@/features/transaction-agent/receipt-input";
import { downloadTelegramAudio, TelegramVoiceFileTooLargeError, type DownloadedTelegramAudio } from "@/lib/telegram/download-file";
import { downloadTelegramReceipt, TelegramReceiptFileTooLargeError, TelegramReceiptUnsupportedTypeError, type DownloadedTelegramReceipt } from "@/lib/telegram/download-receipt";
import { ElevenLabsTranscriptionService, type AudioTranscription } from "@/lib/elevenlabs/transcription";
import { extractReceiptFromImage } from "@/lib/openai/receipt-extraction";
import type { ReceiptExtraction } from "@/lib/openai/receipt-schema";
import type { BotEnvironment } from "@/lib/env";
import { createTelegramSupabaseAdminClient } from "@/bot/supabase-admin";
import { TelegramLinkService } from "@/features/transaction-agent/telegram-linking";
import { LOW_CONFIDENCE_REVIEW_THRESHOLD, MAX_TEXT_MESSAGE_LENGTH, MAX_TRANSACTIONS_RETURNED } from "@/features/transaction-agent/agent-config";
import { ProviderRateLimiter } from "@/features/transaction-agent/provider-rate-limit";
import { formatRecentTransactions, formatTransactionSummary, splitTelegramMessage } from "@/features/transaction-agent/telegram-command-formatters";
import { paginateTransactions, periodFor, searchTransactions, summaryForPeriod, transactionsToCsv, validatePeriod } from "@/features/transaction-agent/daily-bookkeeping";
import { LocalOrchestrationRepository, SupabaseOrchestrationRepository } from "@/features/transaction-agent/orchestration-repository";
import { TransactionOrchestrationService } from "@/features/transaction-agent/orchestration-service";
import type { AgentInputEnvelope, OrchestrationRun } from "@/features/transaction-agent/orchestration.schema";
import { LocalReceivableRepository } from "@/features/transaction-agent/receivables";
import { calculateFinancialInsight, formatFinancialInsight, parseFinancialInsightQuery } from "@/features/transaction-agent/financial-insights";
import { formatSafeTrace } from "@/features/transaction-agent/agent-observability";
import { formatEInvoiceHint } from "@/features/transaction-agent/einvoice-hint";
import { buildPostConfirmInsight } from "@/features/transaction-agent/post-confirm-insights";

type VoiceDependencies = {
  downloadAudio?: (input: Parameters<typeof downloadTelegramAudio>[0]) => Promise<DownloadedTelegramAudio>;
  transcribeAudio?: (input: { filePath: string; filename: string; mediaType: string }) => Promise<AudioTranscription>;
  preferences?: UserPreferenceRepository;
  now?: () => Date;
  inputProcessor?: Pick<TransactionInputProcessor, "process"> & Partial<Pick<TransactionInputProcessor, "advanceBatch">>;
  telegramFetch?: typeof fetch;
  linkService?: Pick<TelegramLinkService, "consume">;
  downloadReceipt?: (input: Parameters<typeof downloadTelegramReceipt>[0]) => Promise<DownloadedTelegramReceipt>;
  extractReceipt?: (input: Parameters<typeof extractReceiptFromImage>[0]) => Promise<ReceiptExtraction>;
  providerRateLimiter?: Pick<ProviderRateLimiter, "check">;
};

type TransactionCallback = { action: DraftAction | "correct" | "transcript" | "undo" | "keep" | "replace" | "drop_new" | `answer.${string}` | `field.${string}`; draftId: string };

export function createDuplicateSaveCallbackData(draftId: string): string { return `tx:save_anyway:${draftId}`; }

export function isNoopTelegramMarkupEdit(error: unknown): boolean {
  return error instanceof Error && /message is not modified/i.test(error.message);
}

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
  const { TELEGRAM_BOT_TOKEN, OPENAI_API_KEY, OPENAI_TRANSACTION_MODEL, ELEVENLABS_API_KEY, ELEVENLABS_STT_MODEL, MAX_VOICE_FILE_BYTES, LOCAL_DATA_DIRECTORY, BOT_PERSISTENCE_MODE = "local" } = environment;
  const bot = new Bot(TELEGRAM_BOT_TOKEN, voiceDependencies.telegramFetch ? { client: { fetch: voiceDependencies.telegramFetch } } : undefined);
  const supabase = BOT_PERSISTENCE_MODE === "supabase" ? createTelegramSupabaseAdminClient() : null;
  const accountResolver = supabase ? new SupabaseTelegramAccountResolver(supabase) : null;
  const repositories: { drafts: DraftRepository; transactions: TransactionRepository } = supabase && accountResolver
    ? { drafts: new SupabaseTelegramDraftRepository(supabase, accountResolver, voiceDependencies.now), transactions: new SupabaseTelegramTransactionRepository(supabase, accountResolver) }
    : createLocalTransactionRepositories(LOCAL_DATA_DIRECTORY);
  const service = draftService ?? new TransactionDraftService(repositories.drafts, repositories.transactions, voiceDependencies.now);
  const conversations = new ConversationService(repositories.drafts, supabase && accountResolver ? new SupabaseTelegramConversationRepository(supabase, accountResolver, voiceDependencies.now) : new LocalConversationStateRepository(LOCAL_DATA_DIRECTORY), voiceDependencies.now);
  const preferences = voiceDependencies.preferences ?? (supabase ? new SupabaseTelegramPreferenceRepository(supabase) : new LocalUserPreferenceRepository(LOCAL_DATA_DIRECTORY, voiceDependencies.now));
  const inputProcessor = voiceDependencies.inputProcessor ?? new TransactionInputProcessor({ drafts: repositories.drafts, draftService: service, conversations, apiKey: OPENAI_API_KEY, model: OPENAI_TRANSACTION_MODEL, extractMultiIntent: extractMultiIntentFromText });
  const orchestrationRepository = supabase && accountResolver
    ? new SupabaseOrchestrationRepository(supabase, (userId, chatId) => accountResolver.require(userId, chatId).then((account) => account.id))
    : new LocalOrchestrationRepository(LOCAL_DATA_DIRECTORY);
  const orchestration = new TransactionOrchestrationService(orchestrationRepository, voiceDependencies.now);
  // Supabase receivables are not migrated in the current authenticated persistence slice.
  const receivables = supabase ? null : new LocalReceivableRepository(LOCAL_DATA_DIRECTORY);
  const elevenLabs = new ElevenLabsTranscriptionService({ apiKey: ELEVENLABS_API_KEY, model: ELEVENLABS_STT_MODEL });
  const now = voiceDependencies.now ?? (() => new Date());
  const linkService = voiceDependencies.linkService ?? (BOT_PERSISTENCE_MODE === "supabase" ? new TelegramLinkService(createTelegramSupabaseAdminClient() as never) : null);
  const providerRateLimiter = voiceDependencies.providerRateLimiter ?? new ProviderRateLimiter();

  const localeFor = (context: Context) => preferences.get(String(context.from?.id ?? ""));
  const allowProviderCall = async (context: Context, locale: BotLocale) => {
    if (!context.from || !context.chat) return false;
    const result = providerRateLimiter.check(`${context.from.id}:${context.chat.id}`);
    if (result.allowed) return true;
    const waitSeconds = Math.max(1, Math.ceil(result.retryAfterMs / 1_000));
    await context.reply(locale === "ms" ? `Terlalu banyak permintaan. Cuba lagi dalam kira-kira ${waitSeconds} saat. Tiada rekod disimpan.` : `Too many requests. Please try again in about ${waitSeconds} seconds. Nothing was saved.`);
    return false;
  };
  const replyHome = async (context: Context, text: string, locale: BotLocale) => context.reply(text, { reply_markup: homeKeyboard(locale) });
  const clearKeyboard = async (context: Context) => {
    try { await context.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } }); }
    catch (error) { if (!isNoopTelegramMarkupEdit(error)) console.warn("Unable to clear Telegram transaction buttons.", error instanceof Error ? error.message : "Unknown error"); }
  };
  const clearConversation = async (draftId: string) => {
    try { await conversations.clearByDraftId(draftId); }
    catch (error) { console.warn("Unable to clear Telegram conversation state.", error instanceof Error ? error.message : "Unknown error"); }
  };
  const clearStoredKeyboard = async (context: Context, inlineMessageId: number | undefined) => {
    if (!inlineMessageId || !context.chat) return;
    try { await context.api.editMessageReplyMarkup(context.chat.id, inlineMessageId, { reply_markup: { inline_keyboard: [] } }); }
    catch (error) { if (!isNoopTelegramMarkupEdit(error)) console.warn("Unable to clear stored Telegram transaction buttons.", error instanceof Error ? error.message : "Unknown error"); }
  };
  const attachKeyboard = async (context: Context, message: Awaited<ReturnType<typeof context.reply>>) => {
    if (context.from && context.chat) await conversations.attachInlineMessage(String(context.from.id), String(context.chat.id), message.message_id);
    return message;
  };
  const replyParts = async (context: Context, message: string) => { for (const part of splitTelegramMessage(message)) await context.reply(part); };
  const showSettings = async (context: Context) => {
    if (!context.from) return;
    const preference = await preferences.getSettings(String(context.from.id));
    return context.reply(settingsMessage(preference.locale, preference), { reply_markup: settingsKeyboard(preference) });
  };

  bot.command("start", async (context) => { const locale = await localeFor(context); return replyHome(context, messages(locale).start, locale); });
  bot.command("help", async (context) => { const locale = await localeFor(context); return replyHome(context, helpMessage(locale, BOT_PERSISTENCE_MODE), locale); });
  bot.command("settings", showSettings);
  bot.command("link", async (context) => {
    const code = context.match?.trim() ?? "";
    if (!context.from || !context.chat) return;
    if (!linkService) return context.reply("Telegram account linking is not enabled in this local demo.");
    const result = await linkService.consume({ code, telegramUserId: String(context.from.id), telegramChatId: String(context.chat.id), username: context.from.username, isPrivateChat: context.chat.type === "private" });
    return context.reply(result === "linked" ? "Your Telegram account is linked. You can now record transactions." : result === "group_chat" ? "For privacy, send your link code in a private chat with the bot." : result === "unavailable" ? "Linking is temporarily unavailable. Please try again." : "That link code is invalid, expired, or has already been used.");
  });

  async function showRecent(context: Context, after?: string) {
    if (!context.from) return;
    const locale = await localeFor(context);
    try {
      const page = paginateTransactions(await repositories.transactions.listByUser(String(context.from.id)), after, MAX_TRANSACTIONS_RETURNED);
      const message = formatRecentTransactions(page.items, undefined, locale) + (page.nextCursor ? `\n\nUse /transactions ${page.nextCursor} for the next page.` : "");
      return replyParts(context, message);
    }
    catch (error) { console.error("Unable to load Telegram transactions.", error instanceof Error ? error.message : "Unknown error"); return context.reply(interfaceText(locale).loadTransactionsFailed); }
  }
  async function showSummary(context: Context, input?: string) {
    if (!context.from) return;
    const locale = await localeFor(context);
    try {
      const settings = await preferences.getSettings(String(context.from.id));
      const period = input ? (() => { const [start, end] = input.trim().split(/\s+/); return start && end ? validatePeriod(start, end) : null; })() : periodFor("month", settings.timezone, now());
      if (!period) return context.reply("Use /summary YYYY-MM-DD YYYY-MM-DD. The start date must not be after the end date.");
      const scoped = summaryForPeriod(await repositories.transactions.listByUser(String(context.from.id)), period);
      const categories = scoped.categories.length ? `\n\nCategory breakdown (bookkeeping guidance only):\n${scoped.categories.map(([name, value]) => `• ${name}: ${new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(value)}`).join("\n")}` : "";
      return replyParts(context, `${formatTransactionSummary([], locale).replace("NiagaAI transaction summary", `NiagaAI transaction summary (${period.start} to ${period.end})`).replace("Income: RM 0.00", `Income: ${new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(scoped.income)}`).replace("Customer payments: RM 0.00", `Customer payments: ${new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(scoped.customerPayments)}`).replace("Expenses: RM 0.00", `Expenses: ${new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(scoped.expenses)}`).replace("Net cash movement: RM 0.00", `Net cash movement: ${new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(scoped.netCashMovement)}`).replace("Transactions recorded: 0", `Transactions recorded: ${scoped.transactionCount}`)}${categories}`);
    }
    catch (error) { console.error("Unable to load Telegram transaction summary.", error instanceof Error ? error.message : "Unknown error"); return context.reply(interfaceText(locale).loadSummaryFailed); }
  }
  async function showInsight(context: Context, input: string) {
    if (!context.from || !context.chat) return;
    const locale = await localeFor(context);
    const settings = await preferences.getSettings(String(context.from.id));
    const query = parseFinancialInsightQuery(input, now(), settings.timezone);
    if (!query) return context.reply("Try /insights profit, /insights sales and expenses, /insights cash in vs cash out, /insights biggest expense categories, or /insights recent transactions.");
    const envelope: AgentInputEnvelope = { updateId: String(context.update.update_id), messageId: String(context.msg?.message_id ?? context.update.update_id), telegramUserId: String(context.from.id), telegramChatId: String(context.chat.id), inputKind: "text", locale, normalizedText: input, receivedAt: now().toISOString() };
    const execution = await orchestration.executeCapability(envelope, "financial_insight", async () => calculateFinancialInsight(query, await repositories.transactions.listByUser(String(context.from!.id)), receivables ? await receivables.listByOwner(String(context.from!.id), String(context.chat!.id)) : null, now(), settings.timezone));
    if (execution.outcome === "duplicate") return;
    if (execution.outcome === "failed") return context.reply("I couldn't calculate that insight right now. No records were changed.");
    return replyParts(context, formatFinancialInsight(query, execution.value, locale));
  }
  bot.command("transactions", (context) => showRecent(context, context.match || undefined));
  bot.command("summary", (context) => showSummary(context, context.match || undefined));
  bot.command("insights", (context) => showInsight(context, context.match?.trim() ?? ""));
  if (process.env.NODE_ENV !== "production") {
    bot.command("agent_trace", async (context) => {
      if (!context.from || !context.chat) return;
      const runs: OrchestrationRun[] = await orchestrationRepository.listRunsByOwner(String(context.from.id), String(context.chat.id), 10);
      const steps = (await Promise.all(runs.map((run) => orchestrationRepository.listSteps(run.id)))).flat();
      return replyParts(context, formatSafeTrace(runs, steps));
    });
  }
  bot.command("search", async (context) => {
    if (!context.from) return; const query = context.match?.trim() ?? ""; const locale = await localeFor(context);
    if (!query || query.length > 120) return context.reply("Use /search followed by up to 120 characters of description, party, category, or exact amount.");
    const results = searchTransactions(await repositories.transactions.listByUser(String(context.from.id)), query);
    return replyParts(context, formatRecentTransactions(results, results.length, locale));
  });
  bot.command("export", async (context) => {
    if (!context.from || !context.chat) return; const [start, end] = (context.match ?? "").trim().split(/\s+/); const period = start && end ? validatePeriod(start, end) : null;
    if (!period) return context.reply("Use /export YYYY-MM-DD YYYY-MM-DD. Exports are local transaction records, not audited reports.");
    const records = (await repositories.transactions.listByUser(String(context.from.id))).filter((item) => item.status === "confirmed" && item.transactionDate && item.transactionDate >= period.start && item.transactionDate <= period.end);
    if (records.length > 2_000) return context.reply("That export is too large. Choose a narrower date range.");
    return context.replyWithDocument(new InputFile(Buffer.from(transactionsToCsv(records), "utf8"), `niagaai-transactions-${period.start}-to-${period.end}.csv`), { caption: "Local transaction export — not an audited report." });
  });

  async function presentResult(context: Context, result: TransactionInputResult, locale: BotLocale) {
    const text = interfaceText(locale);
    if (result.outcome === "expired") return context.reply(text.workflowExpired);
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
    if (result.batch) {
      if (result.batch.index === 1) await context.reply(text.batchIntro(result.batch.total));
      else await context.reply(text.batchNext(result.batch.index, result.batch.total));
    }
    for (const note of result.notes ?? []) await context.reply(note);
    if (result.outcome === "clarification") {
      const remaining = getRequiredMissingFields(result.draft).length;
      return attachKeyboard(context, await context.reply(clarificationMessage(locale, result.draft, result.requestedField, remaining), { reply_markup: clarificationKeyboard(result.requestedField, result.draft.id, locale) }));
    }
    if (result.draft.confidence < LOW_CONFIDENCE_REVIEW_THRESHOLD) await context.reply(text.lowConfidenceHint);
    const review = await attachKeyboard(context, await context.reply(formatDraft(result.draft, locale), { reply_markup: reviewKeyboard(result.draft.id, locale, Boolean(result.draft.transcript)) }));
    const einvoiceHint = formatEInvoiceHint(result.draft, locale);
    if (einvoiceHint) await context.reply(einvoiceHint);
    return review;
  }

  /** After a batch item resolves, present the next queued multi-intent draft, if any. */
  async function presentNextBatchItem(context: Context, userId: string, chatId: string, locale: BotLocale) {
    if (!inputProcessor.advanceBatch) return;
    try {
      const next = await inputProcessor.advanceBatch({ telegramUserId: userId, telegramChatId: chatId });
      if (next) await presentResult(context, next, locale);
    } catch (error) {
      console.warn("Unable to advance transaction batch.", error instanceof Error ? error.message : "Unknown error");
    }
  }

  async function processTransactionInput(context: Context, input: Omit<TransactionInput, "telegramUserId" | "telegramChatId">, locale: BotLocale) {
    if (!context.from || !context.chat) return;
    if (input.text.length > MAX_TEXT_MESSAGE_LENGTH) return context.reply(interfaceText(locale).tooLong);
    const telegramUserId = String(context.from.id);
    const telegramChatId = String(context.chat.id);
    const preference = await preferences.getSettings(telegramUserId);
    const priorState = await conversations.getActive(telegramUserId, telegramChatId);
    const inputKind = input.sourceType === "telegram_voice" ? "voice" : input.sourceType === "telegram_photo" || input.sourceType === "telegram_document" ? "receipt_image" : "text";
    const envelope: AgentInputEnvelope = {
      updateId: String(context.update.update_id),
      messageId: String(context.msg?.message_id ?? context.update.update_id),
      telegramUserId,
      telegramChatId,
      inputKind,
      locale,
      normalizedText: input.text,
      ...(input.telegramFileId ? { mediaReference: input.telegramFileId } : {}),
      receivedAt: now().toISOString(),
    };
    const execution = await orchestration.execute(envelope, () => inputProcessor.process({ ...input, telegramUserId, telegramChatId, defaultPaymentMethod: preference.defaultPaymentMethod, locale }));
    if (execution.outcome === "duplicate") return;
    if (execution.outcome === "failed") throw new Error(`Transaction orchestration failed: ${execution.errorCode}`);
    const result = execution.value;
    if (result.outcome !== "unavailable" && result.outcome !== "expired" && result.restarted) await clearStoredKeyboard(context, priorState?.inlineMessageId);
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
      await conversations.cancel(state);
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
    if (action === "help") return replyHome(context, helpMessage(locale, BOT_PERSISTENCE_MODE), locale);
    if (parseFinancialInsightQuery(text, now(), (await preferences.getSettings(String(context.from.id))).timezone)) return showInsight(context, text);
    if (!await allowProviderCall(context, locale)) return;
    let status: Awaited<ReturnType<typeof context.reply>> | undefined;
    try {
      await context.api.sendChatAction(context.chat.id, "typing");
      status = await context.reply(messages(locale).preparing);
      return await processTransactionInput(context, { text, sourceType: "telegram_text" }, locale);
    } catch (error) {
      console.error("Telegram transaction extraction failed.", error instanceof Error ? error.message : "Unknown error");
      return context.reply(error instanceof TelegramLinkRequiredError ? interfaceText(locale).linkRequired : interfaceText(locale).prepareFailed);
    }
    finally { if (status) await context.api.deleteMessage(context.chat.id, status.message_id).catch(() => undefined); }
  });

  bot.on("message:voice", async (context) => {
    const locale = await localeFor(context);
    const voice = context.message.voice;
    let audio: DownloadedTelegramAudio | undefined;
    let status: Awaited<ReturnType<typeof context.reply>> | undefined;
    try {
      if (!await allowProviderCall(context, locale)) return;
      await context.api.sendChatAction(context.chat.id, "record_voice");
      status = await context.reply(messages(locale).listening);
      audio = await (voiceDependencies.downloadAudio ?? downloadTelegramAudio)({ api: context.api, botToken: TELEGRAM_BOT_TOKEN, fileId: voice.file_id, fileSize: voice.file_size, maxBytes: MAX_VOICE_FILE_BYTES });
      const transcription = await (voiceDependencies.transcribeAudio ?? ((input) => elevenLabs.transcribeAudio(input)))({ filePath: audio.filePath, filename: audio.filename, mediaType: audio.mediaType });
      await context.api.sendChatAction(context.chat.id, "typing");
      return await processTransactionInput(context, { text: transcription.text, sourceType: "telegram_voice", transcript: transcription.text, telegramFileId: voice.file_id }, locale);
    } catch (error) {
      console.error("Telegram voice-note processing failed.", error instanceof Error ? error.message : "Unknown error");
      if (error instanceof TelegramLinkRequiredError) return context.reply(interfaceText(locale).linkRequired);
      if (error instanceof TelegramVoiceFileTooLargeError) return context.reply(interfaceText(locale).voiceTooLarge(Math.floor(MAX_VOICE_FILE_BYTES / (1024 * 1024))));
      return context.reply(interfaceText(locale).voiceFailed);
    } finally {
      if (status) await context.api.deleteMessage(context.chat.id, status.message_id).catch(() => undefined);
      if (audio) await audio.cleanup().catch(() => console.warn("Temporary Telegram voice file cleanup failed."));
    }
  });

  async function processReceipt(
    context: Context,
    input: { fileId: string; fileSize?: number; sourceType: "telegram_photo" | "telegram_document"; caption?: string },
  ) {
    if (!context.from || !context.chat) return;
    const locale = await localeFor(context);
    const text = interfaceText(locale);
    try {
      if (await conversations.getActive(String(context.from.id), String(context.chat.id))) return context.reply(text.receiptWhileActive);
    } catch (error) {
      if (error instanceof TelegramLinkRequiredError) return context.reply(text.linkRequired);
      throw error;
    }
    let receipt: DownloadedTelegramReceipt | undefined;
    let status: Awaited<ReturnType<typeof context.reply>> | undefined;
    let createdDraftId: string | undefined;
    try {
      if (!await allowProviderCall(context, locale)) return;
      await context.api.sendChatAction(context.chat.id, "typing");
      status = await context.reply(text.receiptPreparing);
      receipt = await (voiceDependencies.downloadReceipt ?? downloadTelegramReceipt)({ api: context.api, botToken: TELEGRAM_BOT_TOKEN, fileId: input.fileId, fileSize: input.fileSize });
      const extracted = await (voiceDependencies.extractReceipt ?? extractReceiptFromImage)({ bytes: receipt.bytes, mediaType: receipt.mediaType });
      if (hasMultipleReceiptTransactions(extracted)) return context.reply(text.receiptUnsupported);
      if (!(["MYR", "RM"].includes(extracted.currency.value?.trim().toUpperCase() ?? ""))) return context.reply(text.receiptCurrency);
      if (extracted.total.value === null && extracted.merchantName.value === null && extracted.documentDate.value === null && extracted.lineItems.length === 0) return context.reply(text.receiptUnreadable);
      const execution = await orchestration.execute({
        updateId: String(context.update.update_id),
        messageId: String(context.msg?.message_id ?? context.update.update_id),
        telegramUserId: String(context.from.id),
        telegramChatId: String(context.chat.id),
        inputKind: "receipt_image",
        locale,
        ...(input.caption?.trim() ? { normalizedText: input.caption.trim() } : {}),
        mediaReference: input.fileId,
        receivedAt: now().toISOString(),
      }, async () => {
        const preference = await preferences.getSettings(String(context.from!.id));
        const extraction = applyDefaultPaymentMethod(receiptToTransactionExtraction(extracted), preference.defaultPaymentMethod);
        const draft = await service.createDraft({
          extraction,
          telegramUserId: String(context.from!.id),
          telegramChatId: String(context.chat!.id),
          originalInput: input.caption?.trim() || (input.sourceType === "telegram_photo" ? "Telegram receipt photo" : "Telegram receipt document"),
          sourceType: input.sourceType,
          telegramFileId: input.fileId,
        });
        createdDraftId = draft.id;
        const requestedField = await conversations.beginClarification(draft);
        if (requestedField) return { outcome: "clarification" as const, draft, requestedField };
        await conversations.beginReview(draft);
        return { outcome: "draft" as const, draft };
      });
      if (execution.outcome === "duplicate") return;
      if (execution.outcome === "failed") throw new Error(`Receipt orchestration failed: ${execution.errorCode}`);
      const result = execution.value;
      return presentResult(context, result.outcome === "clarification" ? { outcome: "clarification", question: "", draft: result.draft, requestedField: result.requestedField, restarted: false } : { outcome: "draft", draft: result.draft, restarted: false }, locale);
    } catch (error) {
      if (createdDraftId) {
        await service.act({ action: "cancel", draftId: createdDraftId, telegramUserId: String(context.from.id) }).catch(() => undefined);
        await conversations.clearByDraftId(createdDraftId).catch(() => undefined);
      }
      if (error instanceof TelegramLinkRequiredError) return context.reply(text.linkRequired);
      if (error instanceof TelegramReceiptFileTooLargeError) return context.reply(text.receiptTooLarge);
      if (error instanceof TelegramReceiptUnsupportedTypeError) return context.reply(text.receiptUnsupported);
      console.error("Telegram receipt processing failed.", error instanceof Error ? error.message : "Unknown error");
      return context.reply(text.receiptFailed);
    } finally {
      if (status) await context.api.deleteMessage(context.chat.id, status.message_id).catch(() => undefined);
      if (receipt) await receipt.cleanup().catch(() => console.warn("Temporary Telegram receipt cleanup failed."));
    }
  }

  bot.on("message:photo", async (context) => {
    const photo = context.message.photo.at(-1);
    if (!photo) return;
    return processReceipt(context, { fileId: photo.file_id, fileSize: photo.file_size, sourceType: "telegram_photo", caption: context.message.caption });
  });

  bot.on("message:document", async (context) => processReceipt(context, {
    fileId: context.message.document.file_id,
    fileSize: context.message.document.file_size,
    sourceType: "telegram_document",
    caption: context.message.caption,
  }));

  bot.on("message", async (context) => {
    if (!("sticker" in context.message || "video" in context.message || "contact" in context.message || "location" in context.message || "audio" in context.message)) return;
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
      const preference = await preferences.getSettings(String(context.from.id));
      await context.reply(messages(locale).localeSaved);
      return context.reply(settingsMessage(locale, preference), { reply_markup: settingsKeyboard(preference, locale) });
    }
    const settingsAction = context.callbackQuery.data.match(/^settings:(menu|timezone|payment):([a-z_]+)$/);
    if (settingsAction) {
      const userId = String(context.from.id);
      const locale = await localeFor(context);
      const [, action, value] = settingsAction;
      if (action === "menu") {
        await clearKeyboard(context);
        if (value === "timezone") return context.reply(locale === "ms" ? "Pilih zon waktu anda." : "Choose your timezone.", { reply_markup: timezoneSettingsKeyboard(locale) });
        if (value === "payment") return context.reply(locale === "ms" ? "Pilih cara bayaran lalai untuk draf baharu." : "Choose the default payment method for new drafts.", { reply_markup: paymentSettingsKeyboard(locale) });
        if (value === "main") return showSettings(context);
      }
      if (action === "timezone" && (value === "malaysia" || value === "utc")) {
        await preferences.updateSettings(userId, { timezone: value === "malaysia" ? "Asia/Kuala_Lumpur" : "UTC" });
        await clearKeyboard(context);
        await context.reply(locale === "ms" ? "Zon waktu disimpan." : "Timezone saved.");
        return showSettings(context);
      }
      const paymentMethods = ["cash", "bank_transfer", "card", "ewallet", "credit"] as const;
      if (action === "payment" && (value === "none" || paymentMethods.includes(value as typeof paymentMethods[number]))) {
        await preferences.updateSettings(userId, { defaultPaymentMethod: value === "none" ? null : value as typeof paymentMethods[number] });
        await clearKeyboard(context);
        await context.reply(locale === "ms" ? "Cara bayaran lalai disimpan." : "Default payment method saved.");
        return showSettings(context);
      }
      await clearKeyboard(context);
      return context.reply(interfaceText(locale).staleAction);
    }
    const callback = parseTransactionCallback(context.callbackQuery.data);
    if (!callback) { const locale = await localeFor(context); await clearKeyboard(context); return context.reply(interfaceText(locale).staleAction); }
    const locale = await localeFor(context);
    const text = interfaceText(locale);
    const userId = String(context.from.id);
    const chatId = String(context.chat?.id ?? "");
    const callbackEnvelope: AgentInputEnvelope = {
      updateId: String(context.update.update_id),
      messageId: String(context.update.update_id),
      telegramUserId: userId,
      telegramChatId: chatId,
      inputKind: "callback",
      locale,
      actionId: context.callbackQuery.data,
      receivedAt: now().toISOString(),
    };
    const draft = await repositories.drafts.findById(callback.draftId);
    if (!draft) { await clearKeyboard(context); await clearConversation(callback.draftId); return context.reply(text.missingDraft); }
    if (draft.telegramUserId !== userId || draft.telegramChatId !== chatId) { await clearKeyboard(context); return context.reply(text.foreignAction); }
    const activeState = await conversations.getActive(userId, chatId);
    if (activeState?.draftId === draft.id && isConversationStateExpired(activeState)) {
      await conversations.expire(activeState);
      await service.act({ action: "cancel", draftId: draft.id, telegramUserId: userId }).catch(() => undefined);
      await clearKeyboard(context);
      await conversations.clearByUser(userId, chatId);
      return context.reply(text.workflowExpired);
    }

    if (callback.action === "transcript") return replyParts(context, `${text.transcriptTitle}\n\n${draft.transcript ?? text.noTranscript}`);
    if (callback.action === "undo") {
      const execution = await orchestration.execute(callbackEnvelope, () => service.undo({ transactionId: callback.draftId, telegramUserId: userId, telegramChatId: chatId }));
      if (execution.outcome === "duplicate") return;
      if (execution.outcome === "failed") return context.reply(text.undoUnavailable);
      const outcome = execution.value;
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
    try {
      const execution = await orchestration.execute(callbackEnvelope, () => service.act({ action: callback.action as DraftAction, draftId: callback.draftId, telegramUserId: userId }));
      if (execution.outcome === "duplicate") return;
      if (execution.outcome === "failed") return context.reply(text.actionFailed);
      result = execution.value;
    }
    catch (error) { console.error("Unable to process Telegram transaction action.", error instanceof Error ? error.message : "Unknown error"); return context.reply(text.actionFailed); }
    if (result.outcome === "duplicate") { await clearKeyboard(context); return attachKeyboard(context, await context.reply(`${text.duplicateIntro}\n\n${formatDraft(result.transaction, locale)}`, { reply_markup: duplicateKeyboard(result.draft.id, locale) })); }
    await clearKeyboard(context);
    if (result.outcome === "missing" || result.outcome === "expired") { await clearConversation(callback.draftId); return context.reply(text.expiredDraft); }
    if (result.outcome === "not_owner") return context.reply(text.foreignDraft);
    if (result.outcome === "incomplete") return context.reply(text.incomplete);
    if (result.outcome === "cancelled") {
      if (activeState?.draftId === callback.draftId) await conversations.cancel(activeState);
      await context.reply(text.cancelled);
      return presentNextBatchItem(context, userId, chatId, locale);
    }
    if (result.outcome === "confirmed") {
      if (activeState?.draftId === callback.draftId) await conversations.complete(activeState);
      await context.reply(`${messages(locale).saved(result.transaction.type)}\n\n${formatDraft(result.transaction, locale)}`, { reply_markup: undoKeyboard(result.transaction.id, locale) });
      try {
        const insight = buildPostConfirmInsight(result.transaction, await repositories.transactions.listByUser(userId), locale);
        if (insight) await context.reply(insight);
      } catch (error) { console.warn("Unable to compute post-confirm insight.", error instanceof Error ? error.message : "Unknown error"); }
      return presentNextBatchItem(context, userId, chatId, locale);
    }
    return context.reply(text.staleAction);
  });

  return bot;
}
