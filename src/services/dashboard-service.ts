import { calculateMonthlyMetrics } from "@/lib/transactions/query";
import type { InvoiceRepository, TransactionRepository } from "@/repositories/contracts";

export class DashboardService {
  constructor(private readonly transactions: TransactionRepository, private readonly invoices: InvoiceRepository) {}
  async getSummary(businessId: string, referenceDate = new Date()) {
    const [transactions, invoices] = await Promise.all([
      this.transactions.list({ businessId }),
      this.invoices.list({ businessId }),
    ]);
    return {
      transactions,
      invoices,
      metrics: calculateMonthlyMetrics(transactions, referenceDate),
      reviewCount: transactions.filter((item) => item.status === "needs_review").length,
      outstandingInvoices: invoices.filter((item) => item.status === "sent" || item.status === "partially_paid"),
    };
  }
}
