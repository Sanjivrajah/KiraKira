import { calculateInvoiceTotalsMinor } from "@/lib/invoices/calculations";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import type { Json } from "@/lib/supabase/database.types";
import type { Invoice, InvoiceLineItem } from "@/types";
import type { CommercialDocument, Party } from "@/domain";
import type { SupplierSnapshot } from "@/application/e-invoices";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * The mutation boundary for persisted invoices. These RPCs keep invoice, line
 * item, status-history, payment, and audit writes in one database transaction.
 * Read models can remain tailored to their UI until their query migration.
 */
export class SupabaseInvoiceLifecycleRepository {
  private get client() { return getSupabaseBrowserClient(); }

  async saveDraft(invoice: Invoice) {
    const totals = calculateInvoiceTotalsMinor(invoice.items);
    const { data, error } = await this.client.rpc("save_invoice_draft", {
      p_business_id: invoice.businessId,
      // Local IDs are intentionally not reused as database UUIDs during the
      // migration. Existing UUID records may be updated; new drafts get a DB ID.
      p_invoice_id: uuidPattern.test(invoice.id) ? invoice.id : undefined,
      p_invoice: {
        // Browser-local demo customers use non-UUID IDs. Keep their snapshots
        // for the draft while allowing the database to leave customer_id null.
        customer_id: invoice.customerId && uuidPattern.test(invoice.customerId) ? invoice.customerId : null,
        customer_snapshot: { name: invoice.customerName, email: invoice.customerEmail ?? null, tin: invoice.buyerTin ?? null },
        supplier_snapshot: {}, issue_date: invoice.issueDate, due_date: invoice.dueDate, currency: invoice.currency,
        notes: invoice.notes ?? null, payment_terms: invoice.paymentTerms ?? null, rounding_minor: 0,
        prepaid_minor: Math.round((invoice.prepaymentAmount ?? 0) * 100),
      } as Json,
      p_items: invoice.items.map((item) => this.toItemPayload(item)) as Json,
    });
    if (error) throw error;
    // The server is authoritative: it independently derives these minor-unit totals.
    if (data.total_minor !== totals.totalMinor) throw new Error("The invoice total changed during server validation.");
    return data;
  }

  issue(invoiceId: string, prefix = "INV-", fiscalPeriod = "") {
    return this.unwrap(this.client.rpc("issue_invoice", { p_invoice_id: invoiceId, p_prefix: prefix, p_fiscal_period: fiscalPeriod }));
  }

  updatePrepayment(invoiceId: string, businessId: string, prepaidMinor: number) {
    return this.unwrap(this.client.rpc("update_invoice_prepayment", {
      p_business_id: businessId,
      p_invoice_id: invoiceId,
      p_prepaid_minor: prepaidMinor,
    }));
  }

  /** Persists the rich canonical fields and full party snapshots before a draft is issued. */
  saveComplianceDetails(input: {
    businessId: string;
    invoiceId: string;
    document: CommercialDocument;
    supplierSnapshot: SupplierSnapshot;
    buyerSnapshot: Party;
    supplementalFields?: Record<string, unknown>;
  }) {
    const asJson = (value: unknown) => JSON.parse(JSON.stringify(value)) as Json;
    return this.unwrap(this.client.rpc("save_invoice_compliance_details", {
      p_business_id: input.businessId,
      p_invoice_id: input.invoiceId,
      p_document: asJson(input.document),
      p_supplier_snapshot: asJson(input.supplierSnapshot),
      p_buyer_snapshot: asJson(input.buyerSnapshot),
      p_supplemental_fields: asJson(input.supplementalFields ?? {}),
    }));
  }

  recordPayment(input: { invoiceId: string; amountMinor: number; currency: string; paidAt: string; method?: string | null; reference?: string | null; transactionId?: string | null }) {
    return this.unwrap(this.client.rpc("record_invoice_payment", {
      p_invoice_id: input.invoiceId, p_amount_minor: input.amountMinor, p_currency: input.currency,
      p_paid_at: input.paidAt, p_method: input.method ?? undefined, p_reference: input.reference ?? undefined, p_transaction_id: input.transactionId ?? undefined,
    }));
  }

  reversePayment(paymentId: string, reason: string) { return this.unwrap(this.client.rpc("reverse_invoice_payment", { p_payment_id: paymentId, p_reason: reason })); }
  void(invoiceId: string, reason: string, cancelled = false) { return this.unwrap(this.client.rpc("void_invoice", { p_invoice_id: invoiceId, p_reason: reason, p_cancelled: cancelled })); }
  markOverdue(businessId: string) { return this.unwrap(this.client.rpc("mark_overdue_invoices", { p_business_id: businessId })); }
  claimReminderDelivery(reminderId: string) { return this.unwrap(this.client.rpc("claim_reminder_delivery", { p_reminder_id: reminderId })); }
  completeReminderDelivery(reminderId: string, sent: boolean, providerResponse?: Json) { return this.unwrap(this.client.rpc("complete_reminder_delivery", { p_reminder_id: reminderId, p_sent: sent, p_provider_response: providerResponse })); }

  private toItemPayload(item: InvoiceLineItem) {
    return {
      description: item.description, quantity: item.quantity, unit_price_minor: Math.round(item.unitPrice * 100),
      discount_minor: Math.round((item.discountAmount ?? 0) * 100), charge_minor: Math.round((item.chargeAmount ?? 0) * 100),
      tax_rate: item.taxRate, tax_type_code: item.taxTypeCode ?? "01", unit_code: item.unitCode ?? null,
      classification_code: item.classificationCode ?? null, exemption_reason: item.exemptionReason ?? null,
    };
  }

  private async unwrap<T>(operation: PromiseLike<{ data: T; error: { message: string } | null }>) {
    const { data, error } = await operation;
    if (error) throw error;
    return data;
  }
}
