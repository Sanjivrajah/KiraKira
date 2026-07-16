import type { ConfirmedTransaction } from "@/features/transaction-agent/transaction-record.schema";

export type TransactionSummary = {
  income: number;
  expenses: number;
  customerPayments: number;
  netCashMovement: number;
  transactionCount: number;
};

/** A deliberately small cash-movement summary; customer repayments are not sales income. */
export function calculateTransactionSummary(transactions: readonly ConfirmedTransaction[]): TransactionSummary {
  const activeTransactions = transactions.filter((transaction) => transaction.status === "confirmed");
  const amounts = activeTransactions.reduce((totals, transaction) => {
    if (transaction.type === "income") totals.income += transaction.amount ?? 0;
    if (transaction.type === "expense") totals.expenses += transaction.amount ?? 0;
    if (transaction.type === "customer_payment") totals.customerPayments += transaction.amount ?? 0;
    return totals;
  }, { income: 0, expenses: 0, customerPayments: 0 });

  return {
    ...amounts,
    netCashMovement: amounts.income + amounts.customerPayments - amounts.expenses,
    transactionCount: activeTransactions.length,
  };
}
