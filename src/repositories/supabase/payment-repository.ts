import type { Database } from "@/lib/supabase/database.types";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import type { PaymentRepository } from "@/repositories/contracts";
import type { Payment } from "@/types";
import { SupabaseInvoiceLifecycleRepository } from "./invoice-lifecycle-repository";

type PaymentRow = Database["public"]["Tables"]["invoice_payments"]["Row"];
type PaymentWithInvoice = PaymentRow & { invoices: { business_id: string } | null };

function toPayment(row: PaymentWithInvoice): Payment {
  return {
    amount: row.amount_minor / 100,
    businessId: row.invoices?.business_id ?? "",
    createdAt: row.created_at,
    currency: row.currency as Payment["currency"],
    id: row.id,
    invoiceId: row.invoice_id,
    method: row.payment_method_code,
    paidAt: row.paid_at,
    reference: row.external_reference,
    status: "completed",
    updatedAt: row.created_at,
  };
}

/** Read/write bridge for invoice payments using lifecycle-safe database RPCs. */
export class SupabasePaymentRepository implements PaymentRepository {
  constructor(private readonly lifecycle = new SupabaseInvoiceLifecycleRepository()) {}
  private get client() { return getSupabaseBrowserClient(); }

  async list({ businessId, invoiceId }: { businessId: string; invoiceId?: string }) {
    let query = this.client
      .from("invoice_payments")
      .select("*,invoices!inner(business_id)")
      .eq("invoices.business_id", businessId)
      .order("paid_at", { ascending: false });
    if (invoiceId) query = query.eq("invoice_id", invoiceId);
    const { data, error } = await query;
    if (error) throw new Error(`Could not load payments: ${error.message}`);
    return (data as unknown as PaymentWithInvoice[]).map(toPayment);
  }

  async getById({ businessId, paymentId }: { businessId: string; paymentId: string }) {
    const { data, error } = await this.client
      .from("invoice_payments")
      .select("*,invoices!inner(business_id)")
      .eq("invoices.business_id", businessId)
      .eq("id", paymentId)
      .maybeSingle();
    if (error) throw new Error(`Could not load payment: ${error.message}`);
    return data ? toPayment(data as unknown as PaymentWithInvoice) : null;
  }

  async create({ payment }: { payment: Payment }) {
    const row = await this.lifecycle.recordPayment({
      amountMinor: Math.round(payment.amount * 100),
      currency: payment.currency,
      invoiceId: payment.invoiceId,
      method: payment.method,
      paidAt: payment.paidAt,
      reference: payment.reference,
    });
    return toPayment({ ...(row as PaymentRow), invoices: { business_id: payment.businessId } });
  }

  async update(): Promise<Payment> {
    throw new Error("Server payments are immutable. Reverse the payment and record a replacement.");
  }

  async remove({ businessId, paymentId }: { businessId: string; paymentId: string }) {
    const payment = await this.getById({ businessId, paymentId });
    if (!payment) return;
    await this.lifecycle.reversePayment(paymentId, "Reversed from the web application");
  }

  async clearForBusiness() { throw new Error("Clearing server payments is not supported."); }
  async clear() { throw new Error("Clearing server payments is not supported."); }
}
