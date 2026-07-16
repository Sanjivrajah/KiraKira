import { DEMO_TRANSACTIONS } from "@/data/demo";
import type { TransactionRepository } from "@/repositories/contracts";
import type { Transaction } from "@/types";
import { makeEntityId } from "./id";

type NewTransaction = Omit<Transaction, "id" | "createdAt" | "updatedAt">;

export class TransactionService {
  constructor(private readonly repository: TransactionRepository) {}
  initializeDemo(businessId: string) {
    // The explicit demo repository seeds fixtures. The Supabase adapter only
    // reads persisted records and never writes fixtures into a live business.
    return this.repository.initializeDemo({ businessId, fixtures: DEMO_TRANSACTIONS });
  }
  list(businessId: string) { return this.repository.list({ businessId }); }
  getById(businessId: string, transactionId: string) { return this.repository.getById({ businessId, transactionId }); }
  create(input: NewTransaction) {
    const now = new Date().toISOString();
    return this.repository.create({ transaction: { ...input, id: makeEntityId("txn"), createdAt: now, updatedAt: now } });
  }
  update(transaction: Transaction) {
    return this.repository.update({ businessId: transaction.businessId, transactionId: transaction.id, changes: { ...transaction, updatedAt: new Date().toISOString() } });
  }
  remove(businessId: string, transactionId: string) { return this.repository.remove({ businessId, transactionId }); }
}
