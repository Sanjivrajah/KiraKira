import type { Transaction } from "@/types";

export interface TransactionRepository {
  list(input: { businessId: string }): Promise<Transaction[]>;
  getById(input: { businessId: string; transactionId: string }): Promise<Transaction | null>;
  create(input: { transaction: Transaction }): Promise<Transaction>;
  update(input: { businessId: string; transactionId: string; changes: Partial<Transaction> }): Promise<Transaction>;
  remove(input: { businessId: string; transactionId: string }): Promise<void>;
  initializeDemo(input: { businessId: string; fixtures: Transaction[] }): Promise<Transaction[]>;
  clearForBusiness(input: { businessId: string }): Promise<void>;
  clear(): Promise<void>;
}
