import type { BusinessId, FinancialTransaction, ISODate, TransactionId } from "@/domain";
import type { BusinessScopedRepository } from "../shared/repository";

export interface FinancialTransactionRepository extends BusinessScopedRepository<FinancialTransaction, TransactionId> {
  listByDateRange(businessId: BusinessId, from: ISODate, to: ISODate): Promise<readonly FinancialTransaction[]>;
}
