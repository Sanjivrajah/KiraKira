import type { TransactionRepository } from "@/repositories/contracts";
import type { Transaction } from "@/types";
import { SupabaseTransactionRepository } from "./transaction-repository";
import { toLegacyTransactionView, toDomainTransaction } from "@/frontend/view-models/transaction-adapter";

export class LegacyTransactionRepositoryAdapter implements TransactionRepository {
  private readonly supabaseRepo = new SupabaseTransactionRepository();

  async list(input: { businessId: string }): Promise<Transaction[]> {
    const domainTxns = await this.supabaseRepo.list(input.businessId);
    return domainTxns.map(toLegacyTransactionView);
  }

  async getById(input: { businessId: string; transactionId: string }): Promise<Transaction | null> {
    const domainTxn = await this.supabaseRepo.getById(input.businessId, input.transactionId);
    return domainTxn ? toLegacyTransactionView(domainTxn) : null;
  }

  async create(input: { transaction: Transaction }): Promise<Transaction> {
    const domainTxn = toDomainTransaction(input.transaction);
    const saved = await this.supabaseRepo.create(domainTxn);
    return toLegacyTransactionView(saved);
  }

  async update(input: { businessId: string; transactionId: string; changes: Partial<Transaction> }): Promise<Transaction> {
    // Merge existing to full transaction first because our adapter requires full Transaction
    // For simplicity, we just fetch the existing one, merge changes, and save
    const existing = await this.getById(input);
    if (!existing) throw new Error("Transaction not found for update");
    
    const merged = { ...existing, ...input.changes, updatedAt: new Date().toISOString() };
    const domainTxn = toDomainTransaction(merged);
    
    const saved = await this.supabaseRepo.update(input.businessId, input.transactionId, domainTxn);
    return toLegacyTransactionView(saved);
  }

  async remove(input: { businessId: string; transactionId: string }): Promise<void> {
    return this.supabaseRepo.remove(input.businessId, input.transactionId);
  }

  async initializeDemo(input: { businessId: string; fixtures: Transaction[] }): Promise<Transaction[]> {
    // If the database already has transactions, don't wipe them! Just return them.
    // This allows newly created transactions to persist.
    const { count: existingCount, error } = await this.supabaseRepo['client']
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("business_id", input.businessId);
      
    if (existingCount !== null && existingCount > 0) {
      return this.list({ businessId: input.businessId });
    }

    const results = [];
    for (const fixture of input.fixtures) {
      try {
        const saved = await this.create({ transaction: { ...fixture, businessId: input.businessId } });
        results.push(saved);
      } catch (err: any) {
        if (err.message?.includes("duplicate key") || err.message?.includes("transactions_pkey")) {
          results.push({ ...fixture, businessId: input.businessId });
        } else {
          throw err;
        }
      }
    }
    return results;
  }

  async clearForBusiness(input: { businessId: string }): Promise<void> {
    // In a real app we'd do a bulk delete, but for this adapter we'll just fetch and delete
    const txns = await this.list(input);
    for (const txn of txns) {
      await this.remove({ businessId: input.businessId, transactionId: txn.id });
    }
  }

  async clear(): Promise<void> {
    throw new Error("clear() not supported on live Supabase adapter");
  }
}
