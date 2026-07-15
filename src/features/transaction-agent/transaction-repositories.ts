import { join } from "node:path";
import { confirmedTransactionSchema, transactionDraftSchema, type ConfirmedTransaction, type TransactionDraft } from "@/features/transaction-agent/transaction-record.schema";
import { JsonArrayStore, withLocalStorageLock } from "@/lib/storage/json-store";

export interface DraftRepository {
  ensure(): Promise<void>;
  create(draft: TransactionDraft): Promise<TransactionDraft>;
  findById(id: string): Promise<TransactionDraft | null>;
  update(draft: TransactionDraft): Promise<TransactionDraft>;
}

export interface TransactionRepository {
  ensure(): Promise<void>;
  create(transaction: ConfirmedTransaction): Promise<ConfirmedTransaction>;
  listByUser(telegramUserId: string): Promise<ConfirmedTransaction[]>;
}

export class LocalDraftRepository implements DraftRepository {
  private readonly store: JsonArrayStore<TransactionDraft>;
  constructor(directory: string) { this.store = new JsonArrayStore(join(directory, "transaction-drafts.json")); }

  async ensure(): Promise<void> { await this.readAll(); }

  async create(draft: TransactionDraft): Promise<TransactionDraft> {
    const parsed = transactionDraftSchema.parse(draft);
    return withLocalStorageLock(async () => { const records = await this.readAll(); records.push(parsed); await this.store.write(records); return parsed; });
  }
  async findById(id: string): Promise<TransactionDraft | null> { return (await this.readAll()).find((draft) => draft.id === id) ?? null; }
  async update(draft: TransactionDraft): Promise<TransactionDraft> {
    const parsed = transactionDraftSchema.parse(draft);
    return withLocalStorageLock(async () => {
      const records = await this.readAll(); const index = records.findIndex((record) => record.id === parsed.id);
      if (index === -1) throw new Error("Transaction draft no longer exists.");
      records[index] = parsed; await this.store.write(records); return parsed;
    });
  }
  private async readAll(): Promise<TransactionDraft[]> { return (await this.store.read()).map((record) => transactionDraftSchema.parse(record)); }
}

export class LocalTransactionRepository implements TransactionRepository {
  private readonly store: JsonArrayStore<ConfirmedTransaction>;
  constructor(directory: string) { this.store = new JsonArrayStore(join(directory, "transactions.json")); }

  async ensure(): Promise<void> { await this.readAll(); }
  async create(transaction: ConfirmedTransaction): Promise<ConfirmedTransaction> {
    const parsed = confirmedTransactionSchema.parse(transaction);
    return withLocalStorageLock(async () => { const records = await this.readAll(); records.push(parsed); await this.store.write(records); return parsed; });
  }
  async listByUser(telegramUserId: string): Promise<ConfirmedTransaction[]> { return (await this.readAll()).filter((transaction) => transaction.telegramUserId === telegramUserId); }
  private async readAll(): Promise<ConfirmedTransaction[]> { return (await this.store.read()).map((record) => confirmedTransactionSchema.parse(record)); }
}

export function createLocalTransactionRepositories(directory: string): { drafts: DraftRepository; transactions: TransactionRepository } {
  return { drafts: new LocalDraftRepository(directory), transactions: new LocalTransactionRepository(directory) };
}
