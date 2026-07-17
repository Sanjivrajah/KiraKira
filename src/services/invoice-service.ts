import { DEMO_INVOICES } from "@/data/demo";
import { calculateInvoiceTotals } from "@/lib/invoices/calculations";
import type { InvoiceRepository, ReminderRepository } from "@/repositories/contracts";
import type { Invoice } from "@/types";
import { makeEntityId } from "./id";
import { SupabaseInvoiceLifecycleRepository } from "@/repositories/supabase/invoice-lifecycle-repository";

type NewInvoice = Omit<Invoice, "id" | "createdAt" | "updatedAt" | "subtotal" | "tax" | "total">;

export class InvoiceService {
  constructor(private readonly repository: InvoiceRepository, private readonly reminders: ReminderRepository) {}
  initializeDemo(businessId: string) { return this.repository.initializeDemo({ businessId, fixtures: DEMO_INVOICES }); }
  list(businessId: string) { return this.repository.list({ businessId }); }
  getById(businessId: string, invoiceId: string) { return this.repository.getById({ businessId, invoiceId }); }
  async nextInvoiceNumber(businessId: string) {
    const invoices = await this.repository.list({ businessId });
    const largest = invoices.reduce((max, invoice) => {
      const match = invoice.invoiceNumber.match(/(\d+)$/);
      return Math.max(max, match ? Number(match[1]) : 0);
    }, 1023);
    return `INV-${largest + 1}`;
  }
  create(input: NewInvoice) {
    const now = new Date().toISOString();
    const totals = calculateInvoiceTotals(input.items);
    return this.repository.create({ invoice: { ...input, ...totals, id: makeEntityId("inv"), createdAt: now, updatedAt: now } });
  }
  update(invoice: Invoice) {
    return this.repository.update({ businessId: invoice.businessId, invoiceId: invoice.id, changes: { ...invoice, updatedAt: new Date().toISOString() } });
  }
  async remove(businessId: string, invoiceId: string) {
    await this.repository.remove({ businessId, invoiceId });
    await this.reminders.removeForInvoice({ businessId, invoiceId });
  }

  /** Supabase-only lifecycle operations; callers retain the local demo flow. */
  lifecycle(repository: SupabaseInvoiceLifecycleRepository) {
    return {
      saveDraft: (invoice: Invoice) => repository.saveDraft(invoice),
      saveComplianceDetails: (input: Parameters<SupabaseInvoiceLifecycleRepository["saveComplianceDetails"]>[0]) => repository.saveComplianceDetails(input),
      issue: (invoiceId: string, prefix?: string, fiscalPeriod?: string) => repository.issue(invoiceId, prefix, fiscalPeriod),
      recordPayment: (input: Parameters<SupabaseInvoiceLifecycleRepository["recordPayment"]>[0]) => repository.recordPayment(input),
      reversePayment: (paymentId: string, reason: string) => repository.reversePayment(paymentId, reason),
      void: (invoiceId: string, reason: string, cancelled?: boolean) => repository.void(invoiceId, reason, cancelled),
    };
  }
}
