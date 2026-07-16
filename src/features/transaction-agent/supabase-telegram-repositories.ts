/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase types are intentionally regenerated after this migration. */
import type { BotLocale } from "@/bot/messages";
import type { UserPreferenceRepository, TelegramUserPreference } from "@/bot/user-preferences";
import { CONVERSATION_STATE_EXPIRY_MS } from "@/features/transaction-agent/agent-config";
import type { ConversationStateRepository } from "@/features/transaction-agent/conversation-repository";
import { conversationStateSchema, type ConversationState } from "@/features/transaction-agent/conversation-state";
import { confirmedTransactionSchema, transactionDraftSchema, type ConfirmedTransaction, type TransactionDraft } from "@/features/transaction-agent/transaction-record.schema";
import type { DraftRepository, TransactionRepository } from "@/features/transaction-agent/transaction-repositories";

/** Raised before every trusted-worker read/write when the link or membership is gone. */
export class TelegramLinkRequiredError extends Error {
  constructor() { super("This Telegram chat is not linked to an active NiagaAI business."); this.name = "TelegramLinkRequiredError"; }
}

type Account = { id: string; business_id: string; user_id: string; telegram_user_id: number; telegram_chat_id: number };
type SupabaseLike = any;

export class SupabaseTelegramAccountResolver {
  constructor(private readonly client: SupabaseLike) {}

  async require(telegramUserId: string, telegramChatId: string): Promise<Account> {
    const { data, error } = await this.client.from("telegram_accounts").select("id,business_id,user_id,telegram_user_id,telegram_chat_id").eq("telegram_user_id", Number(telegramUserId)).eq("telegram_chat_id", Number(telegramChatId)).is("unlinked_at", null).not("linked_at", "is", null).maybeSingle();
    if (error || !data?.business_id || !data.user_id) throw new TelegramLinkRequiredError();
    const { data: membership } = await this.client.from("business_members").select("business_id").eq("business_id", data.business_id).eq("user_id", data.user_id).eq("status", "active").in("role", ["owner", "admin", "accountant", "staff"]).maybeSingle();
    if (!membership) throw new TelegramLinkRequiredError();
    return data as Account;
  }

  async requireByDraft(draftId: string): Promise<Account> {
    const { data, error } = await this.client.from("telegram_conversation_states").select("telegram_account_id,telegram_accounts(id,business_id,user_id,telegram_user_id,telegram_chat_id,linked_at,unlinked_at)").eq("draft_id", draftId).maybeSingle();
    const account = data?.telegram_accounts;
    if (error || !account || Array.isArray(account) || !account.business_id || !account.user_id || account.unlinked_at || !account.linked_at) throw new TelegramLinkRequiredError();
    return this.require(String(account.telegram_user_id), String(account.telegram_chat_id));
  }
}

export class SupabaseTelegramDraftRepository implements DraftRepository {
  constructor(private readonly client: SupabaseLike, private readonly accounts: SupabaseTelegramAccountResolver, private readonly now: () => Date = () => new Date()) {}
  async ensure() {}
  async create(draft: TransactionDraft) {
    const parsed = transactionDraftSchema.parse(draft); const account = await this.accounts.require(parsed.telegramUserId, parsed.telegramChatId);
    const { error } = await this.client.from("telegram_conversation_states").insert({ telegram_account_id: account.id, draft_id: parsed.id, draft: parsed, mode: "awaiting_review", expires_at: new Date(this.now().getTime() + CONVERSATION_STATE_EXPIRY_MS).toISOString() });
    if (error) throw new Error("Unable to save the Telegram draft.", { cause: error }); return parsed;
  }
  async findById(id: string) { const { data, error } = await this.client.from("telegram_conversation_states").select("draft").eq("draft_id", id).maybeSingle(); if (error || !data) return null; return transactionDraftSchema.parse(data.draft); }
  async update(draft: TransactionDraft) {
    const parsed = transactionDraftSchema.parse(draft); const account = await this.accounts.require(parsed.telegramUserId, parsed.telegramChatId);
    const { data, error } = await this.client.from("telegram_conversation_states").update({ draft: parsed, version: this.client.rpc ? undefined : undefined }).eq("telegram_account_id", account.id).eq("draft_id", parsed.id).select("draft").single();
    if (error) throw new Error("Unable to update the Telegram draft.", { cause: error }); return transactionDraftSchema.parse(data.draft);
  }
}

export class SupabaseTelegramConversationRepository implements ConversationStateRepository {
  constructor(private readonly client: SupabaseLike, private readonly accounts: SupabaseTelegramAccountResolver, private readonly now: () => Date = () => new Date()) {}
  async ensure() {}
  async findByUser(userId: string, chatId?: string) {
    if (!chatId) return null; const account = await this.accounts.require(userId, chatId);
    const { data, error } = await this.client.from("telegram_conversation_states").select("draft_id,mode,requested_field,inline_message_id,draft,created_at,updated_at").eq("telegram_account_id", account.id).maybeSingle();
    if (error || !data) return null;
    return conversationStateSchema.parse({ telegramUserId: userId, telegramChatId: chatId, draftId: data.draft_id, mode: data.mode, ...(data.requested_field ? { requestedField: data.requested_field } : {}), ...(data.inline_message_id ? { inlineMessageId: data.inline_message_id } : {}), ...(data.draft.replacementInput ? { replacementInput: data.draft.replacementInput } : {}), createdAt: data.created_at, updatedAt: data.updated_at });
  }
  async save(state: ConversationState) {
    const parsed = conversationStateSchema.parse(state); const account = await this.accounts.require(parsed.telegramUserId, parsed.telegramChatId);
    const { data: current, error: readError } = await this.client.from("telegram_conversation_states").select("draft,version").eq("telegram_account_id", account.id).eq("draft_id", parsed.draftId).single();
    if (readError) throw new Error("The Telegram draft is stale.", { cause: readError });
    const draft = { ...current.draft, ...(parsed.replacementInput ? { replacementInput: parsed.replacementInput } : {}) };
    const { error } = await this.client.from("telegram_conversation_states").update({ draft, mode: parsed.mode, requested_field: parsed.requestedField ?? null, inline_message_id: parsed.inlineMessageId ?? null, expires_at: new Date(this.now().getTime() + CONVERSATION_STATE_EXPIRY_MS).toISOString(), version: current.version + 1 }).eq("telegram_account_id", account.id).eq("draft_id", parsed.draftId).eq("version", current.version);
    if (error) throw new Error("The Telegram state changed; please try again.", { cause: error }); return parsed;
  }
  async removeByUser(userId: string, chatId?: string) { if (!chatId) return; const account = await this.accounts.require(userId, chatId); const { error } = await this.client.from("telegram_conversation_states").delete().eq("telegram_account_id", account.id); if (error) throw new Error("Unable to clear Telegram state.", { cause: error }); }
  async removeByDraftId(draftId: string) { const { error } = await this.client.from("telegram_conversation_states").delete().eq("draft_id", draftId); if (error) throw new Error("Unable to clear Telegram state.", { cause: error }); }
}

export class SupabaseTelegramTransactionRepository implements TransactionRepository {
  constructor(private readonly client: SupabaseLike, private readonly accounts: SupabaseTelegramAccountResolver) {}
  async ensure() {}
  async create(transaction: ConfirmedTransaction) {
    const parsed = confirmedTransactionSchema.parse(transaction); const account = await this.accounts.require(parsed.telegramUserId, parsed.telegramChatId);
    if (parsed.amount === null) throw new Error("A confirmed Telegram transaction requires an amount.");
    const payload = { ...parsed, direction: parsed.type === "expense" ? "expense" : "income", transactionType: parsed.type === "expense" ? "expense" : parsed.type === "customer_payment" ? "customer_payment" : "income", amountMinor: Math.round(parsed.amount * 100) };
    const { data, error } = await this.client.rpc("confirm_telegram_transaction", { p_account_id: account.id, p_draft_id: parsed.id, p_idempotency_key: `telegram-confirm:${account.id}:${parsed.id}`, p_transaction: payload });
    if (error) throw new Error("Unable to confirm the Telegram transaction.", { cause: error }); return confirmedTransactionSchema.parse(data);
  }
  async listByUser(telegramUserId: string): Promise<ConfirmedTransaction[]> {
    const { data, error } = await this.client.from("transactions").select("confirmation").contains("confirmation", { telegramUserId }).neq("lifecycle", "voided").limit(2000);
    if (error) throw new Error("Unable to load Telegram transactions.", { cause: error }); return (data ?? []).map((row: any) => confirmedTransactionSchema.parse(row.confirmation));
  }
  async findRecentByUser(userId: string, limit: number): Promise<ConfirmedTransaction[]> { return (await this.listByUser(userId)).sort((a, b) => b.confirmedAt.localeCompare(a.confirmedAt)).slice(0, limit); }
  async findById(id: string) { const { data, error } = await this.client.from("transactions").select("confirmation,lifecycle,voided_at,void_reason").eq("id", id).maybeSingle(); if (error || !data) return null; return confirmedTransactionSchema.parse({ ...data.confirmation, status: data.lifecycle === "voided" ? "voided" : "confirmed", ...(data.voided_at ? { voidedAt: data.voided_at } : {}), ...(data.void_reason ? { voidReason: data.void_reason } : {}) }); }
  async update(transaction: ConfirmedTransaction) {
    const parsed = confirmedTransactionSchema.parse(transaction); const account = await this.accounts.require(parsed.telegramUserId, parsed.telegramChatId);
    if (parsed.status === "voided") {
      const { error } = await this.client.rpc("void_telegram_transaction", { p_account_id: account.id, p_transaction_id: parsed.id, p_reason: parsed.voidReason ?? "Owner requested undo" });
      if (error) throw new Error("Unable to void the Telegram transaction.", { cause: error }); return parsed;
    }
    throw new Error("Telegram transaction amendments are not supported by this repository.");
  }
}

export class SupabaseTelegramPreferenceRepository implements UserPreferenceRepository {
  constructor(private readonly client: SupabaseLike) {}
  async get(userId: string) { return (await this.getSettings(userId)).locale; }
  async getSettings(userId: string): Promise<TelegramUserPreference> {
    const { data } = await this.client.from("telegram_user_preferences").select("language,timezone,preferences,telegram_accounts!inner(telegram_user_id)").eq("telegram_accounts.telegram_user_id", Number(userId)).maybeSingle();
    return { telegramUserId: userId, locale: data?.language === "ms" ? "ms" : "en", timezone: data?.timezone ?? "Asia/Kuala_Lumpur", defaultPaymentMethod: data?.preferences?.defaultPaymentMethod ?? null, updatedAt: new Date().toISOString() };
  }
  async set(userId: string, locale: BotLocale) { const settings = await this.getSettings(userId); await this.updateSettings(userId, { ...settings, timezone: settings.timezone } as any); const { error } = await this.client.from("telegram_user_preferences").update({ language: locale }).eq("telegram_accounts.telegram_user_id", Number(userId)); if (error) throw new Error("Unable to save language preference.", { cause: error }); }
  async updateSettings(userId: string, values: Partial<Pick<TelegramUserPreference, "timezone" | "defaultPaymentMethod">>) { const { error } = await this.client.from("telegram_user_preferences").update({ ...(values.timezone ? { timezone: values.timezone } : {}), ...(values.defaultPaymentMethod !== undefined ? { preferences: { defaultPaymentMethod: values.defaultPaymentMethod } } : {}) }).eq("telegram_accounts.telegram_user_id", Number(userId)); if (error) throw new Error("Unable to save preference.", { cause: error }); }
}
