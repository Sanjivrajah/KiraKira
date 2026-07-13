import type { Transaction } from "@/types/finance";

export type TransactionSort = "newest" | "oldest" | "highest" | "lowest";

export interface TransactionFilters {
  search: string;
  type: "all" | Transaction["type"];
  category: string;
  source: "all" | Transaction["source"];
  status: "all" | Transaction["status"];
  dateFrom: string;
  dateTo: string;
}

export const emptyTransactionFilters: TransactionFilters = {
  search: "",
  type: "all",
  category: "all",
  source: "all",
  status: "all",
  dateFrom: "",
  dateTo: "",
};

export function filterAndSortTransactions(
  transactions: Transaction[],
  filters: TransactionFilters,
  sort: TransactionSort,
) {
  const query = filters.search.trim().toLocaleLowerCase("en-MY");
  return transactions
    .filter((transaction) => {
      const searchable = [transaction.description, transaction.merchantName, transaction.customerName]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("en-MY");
      return (
        (!query || searchable.includes(query)) &&
        (filters.type === "all" || transaction.type === filters.type) &&
        (filters.category === "all" || transaction.category === filters.category) &&
        (filters.source === "all" || transaction.source === filters.source) &&
        (filters.status === "all" || transaction.status === filters.status) &&
        (!filters.dateFrom || transaction.date >= filters.dateFrom) &&
        (!filters.dateTo || transaction.date <= filters.dateTo)
      );
    })
    .toSorted((a, b) => {
      if (sort === "highest") return b.amount - a.amount;
      if (sort === "lowest") return a.amount - b.amount;
      const comparison = a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);
      return sort === "oldest" ? comparison : -comparison;
    });
}

export function calculateMonthlyMetrics(transactions: Transaction[], referenceDate = new Date()) {
  const month = `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, "0")}`;
  const current = transactions.filter((transaction) => transaction.date.startsWith(month));
  const revenue = current.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const expenses = current.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
  return { revenue, expenses, profit: revenue - expenses };
}
