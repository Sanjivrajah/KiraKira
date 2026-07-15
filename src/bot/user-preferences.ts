import { join } from "node:path";
import { z } from "zod";
import type { BotLocale } from "@/bot/messages";
import { JsonArrayStore, withLocalStorageLock } from "@/lib/storage/json-store";

const preferenceSchema = z.object({ telegramUserId: z.string().min(1), locale: z.enum(["en", "ms"]), updatedAt: z.string().datetime() });
export type TelegramUserPreference = z.infer<typeof preferenceSchema>;

export interface UserPreferenceRepository { get(telegramUserId: string): Promise<BotLocale>; set(telegramUserId: string, locale: BotLocale): Promise<void>; }

export class LocalUserPreferenceRepository implements UserPreferenceRepository {
  private readonly store: JsonArrayStore<TelegramUserPreference>;
  constructor(directory: string, private readonly now: () => Date = () => new Date()) { this.store = new JsonArrayStore(join(directory, "telegram-user-preferences.json")); }
  async get(telegramUserId: string): Promise<BotLocale> { return (await this.read()).find((item) => item.telegramUserId === telegramUserId)?.locale ?? "en"; }
  async set(telegramUserId: string, locale: BotLocale): Promise<void> {
    await withLocalStorageLock(async () => {
      const records = await this.read();
      const next = preferenceSchema.parse({ telegramUserId, locale, updatedAt: this.now().toISOString() });
      const index = records.findIndex((item) => item.telegramUserId === telegramUserId);
      if (index < 0) records.push(next); else records[index] = next;
      await this.store.write(records);
    });
  }
  private async read() { return (await this.store.read()).map((item) => preferenceSchema.parse(item)); }
}
