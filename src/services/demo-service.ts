import type { BusinessMembershipRepository, BusinessRepository, InvoiceRepository, PaymentRepository, ReminderRepository, TransactionRepository } from "@/repositories/contracts";

export class DemoService {
  constructor(private readonly repositories: {
    businesses: BusinessRepository;
    memberships: BusinessMembershipRepository;
    transactions: TransactionRepository;
    invoices: InvoiceRepository;
    payments: PaymentRepository;
    reminders: ReminderRepository;
  }) {}
  async reset() {
    await Promise.all([
      this.repositories.businesses.clear(), this.repositories.memberships.clear(), this.repositories.transactions.clear(), this.repositories.invoices.clear(),
      this.repositories.payments.clear(), this.repositories.reminders.clear(),
    ]);
  }
}
