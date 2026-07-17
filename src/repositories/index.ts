import { LocalBusinessRepository } from "./local/local-business-repository";
import { LocalBusinessMembershipRepository } from "./local/local-business-membership-repository";
import { LocalInvoiceRepository } from "./local/local-invoice-repository";
import { LocalPaymentRepository } from "./local/local-payment-repository";
import { LocalReminderRepository } from "./local/local-reminder-repository";
import { LocalTransactionRepository } from "./local/local-transaction-repository";
import { LegacyTransactionRepositoryAdapter } from "./supabase/legacy-transaction-repository-adapter";
import { LegacyInvoiceRepositoryAdapter } from "./supabase/legacy-invoice-repository-adapter";
import { SupabasePaymentRepository } from "./supabase/payment-repository";
import { SupabaseReminderRepository } from "./supabase/reminder-repository";
import { resolveAuthMode } from "@/lib/supabase/env";

const persistenceMode = resolveAuthMode();
export const repositories = {
  businesses: new LocalBusinessRepository(),
  memberships: new LocalBusinessMembershipRepository(),
  // Demo is an explicit adapter. Supabase mode never falls back to browser
  // storage when a database operation fails.
  transactions: persistenceMode === "demo" ? new LocalTransactionRepository() : new LegacyTransactionRepositoryAdapter(),
  invoices: persistenceMode === "demo" ? new LocalInvoiceRepository() : new LegacyInvoiceRepositoryAdapter(),
  payments: persistenceMode === "demo" ? new LocalPaymentRepository() : new SupabasePaymentRepository(),
  reminders: persistenceMode === "demo" ? new LocalReminderRepository() : new SupabaseReminderRepository(),
};

export * from "./contracts";
export { LocalBusinessMembershipRepository, LocalBusinessRepository, LocalInvoiceRepository, LocalPaymentRepository, LocalReminderRepository, LocalTransactionRepository };
export { LegacyTransactionRepositoryAdapter } from "./supabase/legacy-transaction-repository-adapter";
export { LegacyInvoiceRepositoryAdapter } from "./supabase/legacy-invoice-repository-adapter";
export { SupabaseTransactionRepository } from "./supabase/transaction-repository";
export { SupabaseInvoiceLifecycleRepository } from "./supabase/invoice-lifecycle-repository";
export { SupabaseEInvoiceRepository } from "./supabase/e-invoice-repository";
export { SupabaseEInvoiceSubmissionRepository } from "./supabase/e-invoice-submission-repository";
export { SupabasePaymentRepository } from "./supabase/payment-repository";
export { SupabaseReminderRepository } from "./supabase/reminder-repository";
