import { browserStorage, type KeyValueStorage } from "@/lib/storage/browser-storage";
import { STORAGE_KEYS } from "@/lib/storage/storage-keys";
import type { TransactionRepository } from "@/repositories/contracts";
import type { Transaction } from "@/types";
import { LocalEntityStore } from "./local-entity-store";
import { parseTransaction } from "./parsers";

export class LocalTransactionRepository extends LocalEntityStore<Transaction> implements TransactionRepository {
  constructor(storage: KeyValueStorage = browserStorage) { super(STORAGE_KEYS.transactions, storage, parseTransaction); }
  async list({ businessId }: { businessId: string }) { return this.readAll().filter((item) => item.businessId === businessId); }
  async getById({ businessId, transactionId }: { businessId: string; transactionId: string }) { return this.readAll().find((item) => item.businessId === businessId && item.id === transactionId) ?? null; }
  async create({ transaction }: { transaction: Transaction }) { return this.createEntity(transaction); }
  async update({ businessId, transactionId, changes }: { businessId: string; transactionId: string; changes: Partial<Transaction> }) { return this.updateEntity(transactionId, { ...changes, businessId }, businessId); }
  async remove({ businessId, transactionId }: { businessId: string; transactionId: string }) { this.removeEntity(transactionId, businessId); }
  async initializeDemo({ businessId, fixtures }: { businessId: string; fixtures: Transaction[] }) {
    if (!this.hasStoredValue()) this.writeAll(fixtures);
    return this.list({ businessId });
  }
  async clearForBusiness({ businessId }: { businessId: string }) { this.writeAll(this.readAll().filter((item) => item.businessId !== businessId)); }
  async clear() { this.clearAll(); }
}
