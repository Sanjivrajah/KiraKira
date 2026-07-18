import type { Database, Json } from "@/lib/supabase/database.types";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import type { InvoiceRepository } from "@/repositories/contracts";
import type { Invoice, InvoiceLineItem } from "@/types";
import { SupabaseInvoiceLifecycleRepository } from "./invoice-lifecycle-repository";

type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];
type InvoiceItemRow = Database["public"]["Tables"]["invoice_items"]["Row"];
type InvoiceWithItems = InvoiceRow & { invoice_items: InvoiceItemRow[] };

function toAmount(minor: number) {
  return minor / 100;
}

function snapshotValue(snapshot: Json, field: "name" | "email" | "tin") {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const value = (snapshot as Record<string, Json>)[field];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function toInvoiceStatus(status: string): Invoice["status"] {
  return status === "cancelled" ? "void" : status as Invoice["status"];
}

function toInvoice(row: InvoiceWithItems): Invoice {
  return {
    amountPaid: toAmount(row.amount_paid_minor),
    businessId: row.business_id,
    buyerTin: snapshotValue(row.customer_snapshot, "tin"),
    createdAt: row.created_at,
    currency: row.currency as Invoice["currency"],
    customerEmail: snapshotValue(row.customer_snapshot, "email"),
    customerId: row.customer_id,
    customerName: snapshotValue(row.customer_snapshot, "name") ?? "Customer",
    dueDate: row.due_date ?? row.issue_date,
    documentType: row.document_type as Invoice["documentType"],
    id: row.id,
    invoiceNumber: row.invoice_number,
    issueDate: row.issue_date,
    issueTime: row.issue_time ?? undefined,
    items: row.invoice_items
      .sort((a, b) => a.line_number - b.line_number)
      .map((item): InvoiceLineItem => ({
        chargeAmount: toAmount(item.charge_minor),
        classificationCode: item.classification_code ?? undefined,
        description: item.description,
        discountAmount: toAmount(item.discount_minor),
        exemptionReason: item.exemption_reason ?? undefined,
        id: item.id,
        quantity: item.quantity,
        taxRate: item.tax_rate,
        taxTypeCode: item.tax_type_code,
        unitCode: item.unit_code ?? undefined,
        unitPrice: toAmount(item.unit_price_minor),
      })),
    notes: row.notes,
    paymentTerms: row.payment_terms,
    paymentModeCode: row.payment_mode_code,
    bankAccountIdentifier: row.bank_account_identifier,
    originalDocumentReference: Array.isArray(row.document_references) && row.document_references[0] && typeof row.document_references[0] === "object" && !Array.isArray(row.document_references[0])
      ? String((row.document_references[0] as Record<string, Json>).externalReference ?? "") || null
      : null,
    prepaymentAmount: toAmount(row.prepaid_minor),
    status: toInvoiceStatus(row.status),
    subtotal: toAmount(row.subtotal_minor),
    tax: toAmount(row.tax_minor),
    total: toAmount(row.total_minor),
    updatedAt: row.updated_at,
  };
}

/** Bridges the current invoice UI to the server-authoritative lifecycle APIs. */
export class LegacyInvoiceRepositoryAdapter implements InvoiceRepository {
  constructor(private readonly lifecycle = new SupabaseInvoiceLifecycleRepository()) {}

  private get client() {
    return getSupabaseBrowserClient();
  }

  async list({ businessId }: { businessId: string }) {
    const { data, error } = await this.client
      .from("invoices")
      .select("*,invoice_items(*)")
      .eq("business_id", businessId)
      .not("status", "in", "(void,cancelled)")
      .order("issue_date", { ascending: false });
    if (error) throw new Error(`Could not load invoices: ${error.message}`);
    return (data as unknown as InvoiceWithItems[]).map(toInvoice);
  }

  async getById({ businessId, invoiceId }: { businessId: string; invoiceId: string }) {
    const { data, error } = await this.client
      .from("invoices")
      .select("*,invoice_items(*)")
      .eq("business_id", businessId)
      .eq("id", invoiceId)
      .maybeSingle();
    if (error) throw new Error(`Could not load invoice: ${error.message}`);
    return data ? toInvoice(data as unknown as InvoiceWithItems) : null;
  }

  async create({ invoice }: { invoice: Invoice }) {
    const saved = await this.lifecycle.saveDraft(invoice);
    if (invoice.status === "sent") await this.lifecycle.issue(saved.id);
    const result = await this.getById({ businessId: invoice.businessId, invoiceId: saved.id });
    if (!result) throw new Error("Invoice was saved but could not be reloaded.");
    return result;
  }

  async update({ businessId, invoiceId, changes }: { businessId: string; invoiceId: string; changes: Partial<Invoice> }) {
    const existing = await this.getById({ businessId, invoiceId });
    if (!existing) throw new Error("Invoice not found.");
    const invoice = { ...existing, ...changes, businessId, id: invoiceId };
    const prepaymentChanged = invoice.prepaymentAmount !== existing.prepaymentAmount;
    if (invoice.status === "void") {
      await this.lifecycle.void(invoiceId, "Voided from the web application");
    } else if (existing.status === "draft") {
      await this.lifecycle.saveDraft(invoice);
      if (invoice.status === "sent") await this.lifecycle.issue(invoiceId);
    } else if (prepaymentChanged && invoice.status === existing.status) {
      await this.lifecycle.updatePrepayment(invoiceId, invoice.businessId, Math.round((invoice.prepaymentAmount ?? 0) * 100));
    } else if (invoice.status !== existing.status) {
      throw new Error("Record a payment to update a sent invoice's payment status.");
    }
    const result = await this.getById({ businessId, invoiceId });
    if (!result) throw new Error("Invoice could not be reloaded.");
    return result;
  }

  async remove({ businessId, invoiceId }: { businessId: string; invoiceId: string }) {
    const invoice = await this.getById({ businessId, invoiceId });
    if (!invoice) return;
    await this.lifecycle.void(invoiceId, "Removed from the web application");
  }

  initializeDemo({ businessId }: { businessId: string; fixtures: Invoice[] }) {
    return this.list({ businessId });
  }

  async clearForBusiness() {
    throw new Error("Clearing server invoices is not supported.");
  }

  async clear() {
    throw new Error("Clearing server invoices is not supported.");
  }
}
