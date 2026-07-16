import { LocalBusinessRepository } from "./local/local-business-repository";
import { LocalBusinessMembershipRepository } from "./local/local-business-membership-repository";
import { LocalInvoiceRepository } from "./local/local-invoice-repository";
import { LocalPaymentRepository } from "./local/local-payment-repository";
import { LocalReminderRepository } from "./local/local-reminder-repository";
import { LocalTransactionRepository } from "./local/local-transaction-repository";
import { LegacyTransactionRepositoryAdapter } from "./supabase/legacy-transaction-repository-adapter";
import { resolveAuthMode } from "@/lib/supabase/env";

const persistenceMode = resolveAuthMode();
export const repositories = {
  businesses: new LocalBusinessRepository(),
  memberships: new LocalBusinessMembershipRepository(),
  // Demo is an explicit adapter. Supabase mode never falls back to browser
  // storage when a database operation fails.
  transactions: persistenceMode === "demo" ? new LocalTransactionRepository() : new LegacyTransactionRepositoryAdapter(),
  invoices: new LocalInvoiceRepository(),
  payments: new LocalPaymentRepository(),
  reminders: new LocalReminderRepository(),
};

export * from "./contracts";
export { LocalBusinessMembershipRepository, LocalBusinessRepository, LocalInvoiceRepository, LocalPaymentRepository, LocalReminderRepository, LocalTransactionRepository };
export { LegacyTransactionRepositoryAdapter } from "./supabase/legacy-transaction-repository-adapter";
export { SupabaseTransactionRepository } from "./supabase/transaction-repository";
