import { join } from "node:path";
import { z } from "zod";
import type { BotLocale } from "@/bot/messages";
import { JsonArrayStore, withLocalStorageLock } from "@/lib/storage/json-store";

const preferenceSchema = z.object({ telegramUserId: z.string().min(1), locale: z.enum(["en", "ms"]), timezone: z.string().min(1).default("Asia/Kuala_Lumpur"), defaultPaymentMethod: z.enum(["cash", "bank_transfer", "card", "ewallet", "credit"]).nullable().default(null), updatedAt: z.string().datetime() });
export type TelegramUserPreference = z.infer<typeof preferenceSchema>;

export interface UserPreferenceRepository { get(telegramUserId: string): Promise<BotLocale>; getSettings(telegramUserId: string): Promise<TelegramUserPreference>; set(telegramUserId: string, locale: BotLocale): Promise<void>; updateSettings(telegramUserId: string, values: Partial<Pick<TelegramUserPreference, "timezone" | "defaultPaymentMethod">>): Promise<void>; }

export class LocalUserPreferenceRepository implements UserPreferenceRepository {
  private readonly store: JsonArrayStore<TelegramUserPreference>;
  constructor(directory: string, private readonly now: () => Date = () => new Date()) { this.store = new JsonArrayStore(join(directory, "telegram-user-preferences.json")); }
  async get(telegramUserId: string): Promise<BotLocale> { return (await this.read()).find((item) => item.telegramUserId === telegramUserId)?.locale ?? "en"; }
  async getSettings(telegramUserId: string): Promise<TelegramUserPreference> { return (await this.read()).find((item) => item.telegramUserId === telegramUserId) ?? preferenceSchema.parse({ telegramUserId, locale: "en", updatedAt: this.now().toISOString() }); }
  async set(telegramUserId: string, locale: BotLocale): Promise<void> {
    const previous = await this.getSettings(telegramUserId);
    await this.setRecord({ ...previous, locale, updatedAt: this.now().toISOString() });
  }
  async updateSettings(telegramUserId: string, values: Partial<Pick<TelegramUserPreference, "timezone" | "defaultPaymentMethod">>): Promise<void> {
    const previous = await this.getSettings(telegramUserId); await this.setRecord({ ...previous, ...values, updatedAt: this.now().toISOString() });
  }
  private async setRecord(next: TelegramUserPreference): Promise<void> { await withLocalStorageLock(async () => { const records = await this.read(); const index = records.findIndex((item) => item.telegramUserId === next.telegramUserId); if (index < 0) records.push(preferenceSchema.parse(next)); else records[index] = preferenceSchema.parse(next); await this.store.write(records); }); }
  private async read() { return (await this.store.read()).map((item) => preferenceSchema.parse(item)); }
}
