import { LocalBusinessRepository } from "./local/local-business-repository";
import { LocalBusinessMembershipRepository } from "./local/local-business-membership-repository";
import { LocalInvoiceRepository } from "./local/local-invoice-repository";
import { LocalPaymentRepository } from "./local/local-payment-repository";
import { LocalReminderRepository } from "./local/local-reminder-repository";
import { LocalTransactionRepository } from "./local/local-transaction-repository";
export const repositories = {
  businesses: new LocalBusinessRepository(),
  memberships: new LocalBusinessMembershipRepository(),
  // Session 1 introduces Auth only. Financial persistence remains local until
  // the schema, RLS, and repository migration sessions are complete.
  transactions: new LocalTransactionRepository(),
  invoices: new LocalInvoiceRepository(),
  payments: new LocalPaymentRepository(),
  reminders: new LocalReminderRepository(),
};

export * from "./contracts";
export { LocalBusinessMembershipRepository, LocalBusinessRepository, LocalInvoiceRepository, LocalPaymentRepository, LocalReminderRepository, LocalTransactionRepository };
