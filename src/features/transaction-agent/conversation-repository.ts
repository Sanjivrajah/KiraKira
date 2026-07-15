import { join } from "node:path";
import { conversationStateSchema, type ConversationState } from "@/features/transaction-agent/conversation-state";
import { JsonArrayStore, withLocalStorageLock } from "@/lib/storage/json-store";

export interface ConversationStateRepository {
  ensure(): Promise<void>;
  findByUser(telegramUserId: string): Promise<ConversationState | null>;
  save(state: ConversationState): Promise<ConversationState>;
  removeByUser(telegramUserId: string): Promise<void>;
  removeByDraftId(draftId: string): Promise<void>;
}

export class LocalConversationStateRepository implements ConversationStateRepository {
  private readonly store: JsonArrayStore<ConversationState>;

  constructor(directory: string) { this.store = new JsonArrayStore(join(directory, "conversation-states.json")); }

  async ensure(): Promise<void> { await this.readAll(); }
  async findByUser(telegramUserId: string): Promise<ConversationState | null> {
    return (await this.readAll()).find((state) => state.telegramUserId === telegramUserId) ?? null;
  }
  async save(state: ConversationState): Promise<ConversationState> {
    const parsed = conversationStateSchema.parse(state);
    return withLocalStorageLock(async () => {
      const states = await this.readAll();
      const index = states.findIndex((item) => item.telegramUserId === parsed.telegramUserId);
      if (index === -1) states.push(parsed); else states[index] = parsed;
      await this.store.write(states);
      return parsed;
    });
  }
  async removeByUser(telegramUserId: string): Promise<void> { await this.remove((state) => state.telegramUserId === telegramUserId); }
  async removeByDraftId(draftId: string): Promise<void> { await this.remove((state) => state.draftId === draftId); }
  private async remove(predicate: (state: ConversationState) => boolean): Promise<void> {
    await withLocalStorageLock(async () => { await this.store.write((await this.readAll()).filter((state) => !predicate(state))); });
  }
  private async readAll(): Promise<ConversationState[]> { return (await this.store.read()).map((state) => conversationStateSchema.parse(state)); }
}
