import { financialTransactionSchema, type BusinessId, type FinancialTransaction, type TransactionId, type UserId } from "@/domain";
import { ApplicationError } from "../shared/repository";
import type { FinancialTransactionRepository } from "./transaction-repository";

export interface ConfirmTransactionCommand {
  businessId: BusinessId;
  transactionId: TransactionId;
  confirmedBy: UserId;
  confirmedAt: string;
  notes?: string;
  idempotencyKey: string;
}

export class ConfirmTransactionService {
  constructor(private readonly transactions: FinancialTransactionRepository) {}

  async execute(command: ConfirmTransactionCommand): Promise<FinancialTransaction> {
    const existing = await this.transactions.findByIdempotencyKey(command.businessId, command.idempotencyKey);
    if (existing) return existing;
    const transaction = await this.transactions.getById(command.businessId, command.transactionId);
    if (!transaction) throw new ApplicationError("transaction.not_found", "Transaction was not found for this business.");
    if (transaction.lifecycle === "voided") throw new ApplicationError("transaction.voided", "A voided transaction cannot be confirmed.");
    const confirmed = financialTransactionSchema.parse({
      ...transaction,
      lifecycle: "confirmed",
      confirmation: {
        confirmedBy: command.confirmedBy,
        confirmedAt: command.confirmedAt,
        ...(command.notes ? { notes: command.notes } : {}),
      },
      updatedAt: command.confirmedAt,
      updatedBy: command.confirmedBy,
      version: (transaction.version ?? 0) + 1,
    });
    return this.transactions.save(command.businessId, confirmed, { idempotencyKey: command.idempotencyKey, expectedVersion: transaction.version });
  }
}

