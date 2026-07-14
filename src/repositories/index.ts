import { LocalBusinessRepository } from "./local/local-business-repository";
import { LocalInvoiceRepository } from "./local/local-invoice-repository";
import { LocalPaymentRepository } from "./local/local-payment-repository";
import { LocalReminderRepository } from "./local/local-reminder-repository";
import { LocalTransactionRepository } from "./local/local-transaction-repository";

export const repositories = {
  businesses: new LocalBusinessRepository(),
  transactions: new LocalTransactionRepository(),
  invoices: new LocalInvoiceRepository(),
  payments: new LocalPaymentRepository(),
  reminders: new LocalReminderRepository(),
};

export * from "./contracts";
export { LocalBusinessRepository, LocalInvoiceRepository, LocalPaymentRepository, LocalReminderRepository, LocalTransactionRepository };
