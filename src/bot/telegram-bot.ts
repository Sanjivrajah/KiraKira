import { Bot } from "grammy";
import { extractTransactionFromText, reextractTransactionDraft, TransactionExtractionError } from "@/features/transaction-agent/transaction-extractor";
import { formatTransactionDraft } from "@/features/transaction-agent/transaction-formatter";
import { TransactionDraftService, type DraftAction } from "@/features/transaction-agent/transaction-confirmation";
import { createLocalTransactionRepositories } from "@/features/transaction-agent/transaction-repositories";
import { LocalConversationStateRepository } from "@/features/transaction-agent/conversation-repository";
import { ConversationService } from "@/features/transaction-agent/conversation-service";
import { getClarificationQuestion } from "@/features/transaction-agent/clarification";
import { isConversationStateExpired } from "@/features/transaction-agent/conversation-state";
import type { BotEnvironment } from "@/lib/env";

export const startMessage = `Welcome to NiagaAI's Telegram assistant.

You can record a business transaction in English, Bahasa Melayu, or Manglish.

For example: Semalam beli ayam RM85 cash dekat Pasar Borong

I will show a reviewable draft. Transactions are saved locally only after you confirm them.`;

export const helpMessage = `NiagaAI will help you capture business income, expenses, and customer payments from text or voice notes.

Try messages such as:
- Sold 10 nasi lemak RM5 each cash today
- Customer Ravi transfer RM450 for catering semalam
- Semalam beli ayam RM85 cash dekat Pasar Borong

Review each extracted draft, then choose Confirm to save it locally, Correct to start again, or Cancel.`;

const callbackPrefix = "transaction";
type TextMessageContext = {
  message: { text: string };
  from: { id: number };
  chat: { id: number };
  reply: (text: string, other?: { reply_markup?: ReturnType<typeof transactionKeyboard> }) => Promise<unknown>;
};

function transactionKeyboard(id: string) {
  return { inline_keyboard: [[
    { text: "Confirm", callback_data: `${callbackPrefix}:confirm:${id}` },
    { text: "Correct", callback_data: `${callbackPrefix}:correct:${id}` },
    { text: "Cancel", callback_data: `${callbackPrefix}:cancel:${id}` },
  ]] };
}

function parseCallbackData(data: string | undefined): { action: DraftAction; draftId: string } | null {
  const match = data?.match(/^transaction:(confirm|correct|cancel):([0-9a-f-]{36})$/i);
  return match ? { action: match[1] as DraftAction, draftId: match[2] } : null;
}

export function createTelegramBot(environment: BotEnvironment, draftService?: TransactionDraftService): Bot {
  const { TELEGRAM_BOT_TOKEN, OPENAI_API_KEY, OPENAI_TRANSACTION_MODEL, LOCAL_DATA_DIRECTORY } = environment;
  const bot = new Bot(TELEGRAM_BOT_TOKEN);
  const repositories = createLocalTransactionRepositories(LOCAL_DATA_DIRECTORY);
  const service = draftService ?? (() => {
    return new TransactionDraftService(repositories.drafts, repositories.transactions);
  })();
  const conversations = new ConversationService(repositories.drafts, new LocalConversationStateRepository(LOCAL_DATA_DIRECTORY));

  bot.command("start", (context) => context.reply(startMessage));
  bot.command("help", (context) => context.reply(helpMessage));

  async function processNewTransaction(context: TextMessageContext) {
    const input = context.message.text;
    const draft = await extractTransactionFromText({ input, apiKey: OPENAI_API_KEY, model: OPENAI_TRANSACTION_MODEL });
    const savedDraft = await service.createDraft({ extraction: draft, telegramUserId: String(context.from.id), telegramChatId: String(context.chat.id), originalInput: input });
    const requestedField = await conversations.beginClarification(savedDraft);
    if (requestedField) return context.reply(getClarificationQuestion(requestedField));
    return context.reply(formatTransactionDraft(savedDraft), { reply_markup: transactionKeyboard(savedDraft.id) });
  }

  bot.command("cancel", async (context) => {
    if (!context.from) return;
    const userId = String(context.from.id);
    const state = await conversations.getActive(userId);
    if (!state) return context.reply("There is no active transaction flow to cancel.");
    const result = await service.act({ action: "cancel", draftId: state.draftId, telegramUserId: userId });
    await conversations.clearByUser(userId);
    return context.reply(result.outcome === "cancelled" ? "Your active transaction flow has been cancelled. No transaction was saved." : "Your active transaction flow has been cancelled.");
  });

  bot.on("message:text", async (context) => {
    if (context.message.text.trim().startsWith("/")) return;

    try {
      const userId = String(context.from.id);
      const state = await conversations.getActive(userId);
      if (!state) return processNewTransaction(context);
      if (isConversationStateExpired(state)) {
        await conversations.clearByUser(userId);
        await context.reply("Your previous transaction flow expired. I’ll treat this as a new transaction.");
        return processNewTransaction(context);
      }
      const currentDraft = await repositories.drafts.findById(state.draftId);
      if (!currentDraft || currentDraft.telegramUserId !== userId || currentDraft.status !== "pending") {
        await conversations.clearByUser(userId);
        await context.reply("Your previous transaction flow is no longer available. I’ll treat this as a new transaction.");
        return processNewTransaction(context);
      }
      const extraction = await reextractTransactionDraft({ originalInput: currentDraft.originalInput, currentDraft, requestedField: state.requestedField, reply: context.message.text, apiKey: OPENAI_API_KEY, model: OPENAI_TRANSACTION_MODEL });
      const result = await conversations.replaceDraft({ state, telegramUserId: userId, extraction });
      if (result.outcome !== "updated") return context.reply("That transaction is no longer available. Please send it again as a new message.");
      if (result.nextField) return context.reply(getClarificationQuestion(result.nextField));
      return context.reply(formatTransactionDraft(result.draft), { reply_markup: transactionKeyboard(result.draft.id) });
    } catch (error) {
      console.error("Telegram transaction extraction failed.", error instanceof TransactionExtractionError ? error.message : error);
      return context.reply("I couldn't turn that into a transaction draft right now. Please try again in a moment. Nothing was saved.");
    }
  });

  bot.on("callback_query:data", async (context) => {
    const callback = parseCallbackData(context.callbackQuery.data);
    if (!callback) return context.answerCallbackQuery({ text: "This action is no longer available." });

    const result = await service.act({ ...callback, telegramUserId: String(context.from.id) });
    if (result.outcome === "missing" || result.outcome === "expired") {
      return context.answerCallbackQuery({ text: "This draft has expired or was already handled." });
    }
    if (result.outcome === "not_owner") return context.answerCallbackQuery({ text: "This draft belongs to another user." });
    if (result.outcome === "incomplete") {
      await context.answerCallbackQuery({ text: "More information is needed before confirmation." });
      return context.reply(`This transaction is not ready to save. Missing: ${result.missingFields.join(", ")}.`);
    }

    await context.answerCallbackQuery();
    if (result.outcome === "correct") {
      await conversations.beginCorrection(result.draft);
      await context.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
      return context.reply("What would you like to correct? You can reply naturally, for example: The amount was RM350 and I paid by bank transfer.");
    }
    await context.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
    if (result.outcome === "cancelled") {
      await conversations.clearByDraftId(callback.draftId);
      return context.reply("This transaction was not saved.");
    }
    if (result.outcome === "confirmed") await conversations.clearByDraftId(callback.draftId);
    if (result.outcome === "confirmed") return context.reply(`Transaction confirmed and saved locally.\n\n${formatTransactionDraft({ ...result.transaction, missingFields: [] })}`);
    return context.reply("This draft has expired or was already handled.");
  });

  return bot;
}
