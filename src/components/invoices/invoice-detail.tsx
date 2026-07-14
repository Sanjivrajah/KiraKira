"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, FileText, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { MoneyDisplay } from "@/components/shared/money-display";
import { useDeleteInvoice, useInvoice, useUpdateInvoice } from "@/hooks/use-invoices";
import { useBusiness } from "@/hooks/use-business";
import { getEffectiveInvoiceStatus, parseLocalDate } from "@/lib/invoices/calculations";
import type { InvoiceStatus } from "@/types";
import { invoiceStatusLabels } from "./invoice-list";

const dateFormatter = new Intl.DateTimeFormat("en-MY", { dateStyle: "long" });
const dateTimeFormatter = new Intl.DateTimeFormat("en-MY", { dateStyle: "medium", timeStyle: "short" });

export function InvoiceDetail({ id }: { id: string }) {
  const router = useRouter();
  const business = useBusiness().data;
  const businessId = business?.id || "business_demo";
  const invoiceQuery = useInvoice(businessId, id);
  const updateInvoice = useUpdateInvoice();
  const deleteInvoice = useDeleteInvoice();
  const invoice = invoiceQuery.data;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (invoiceQuery.isPending) return <LoadingState label="Loading invoice" />;
  if (invoiceQuery.isError) return <><Link className="back-link" href="/invoices"><ArrowLeft aria-hidden="true" size={17} />Back to invoices</Link><ErrorState title="We could not load this invoice" description="Your invoice is still on this device. Try loading it again." /><button className="button button-secondary" onClick={() => invoiceQuery.refetch()} type="button">Try again</button></>;
  if (!invoice) {
    return <><Link className="back-link" href="/invoices"><ArrowLeft aria-hidden="true" size={17} />Back to invoices</Link><ErrorState title="Invoice not found" description="This invoice may have been deleted, or the link is no longer valid." /></>;
  }

  const effectiveStatus = getEffectiveInvoiceStatus(invoice);
  const changeStatus = async (status: InvoiceStatus) => {
    const updated = { ...invoice, status, updatedAt: new Date().toISOString() };
    setMessage("");
    setError("");
    try {
      await updateInvoice.mutateAsync(updated);
      setError("");
      setMessage(`${invoice.invoiceNumber} marked as ${invoiceStatusLabels[status].toLowerCase()}.`);
    } catch {
      setError("We could not save this status. Check browser storage and try again.");
    }
  };

  const remove = async () => {
    setMessage("");
    setError("");
    try {
      await deleteInvoice.mutateAsync({ businessId: invoice.businessId, invoiceId: invoice.id });
      router.push("/invoices?deleted=1");
    } catch {
      setConfirmDelete(false);
      setError("We could not delete this invoice. Please try again.");
    }
  };

  return (
    <>
      <Link className="back-link" href="/invoices"><ArrowLeft aria-hidden="true" size={17} />Back to invoices</Link>
      <header className="invoice-detail-header"><div><p className="eyebrow">Invoice detail</p><h1>{invoice.invoiceNumber}</h1><p>Issued to {invoice.customerName}</p></div><div className="invoice-detail-total"><span>Total due</span><MoneyDisplay amount={invoice.total} /></div></header>

      {message ? <div className="inline-success" role="status"><CheckCircle2 aria-hidden="true" size={18} />{message}<button aria-label="Dismiss message" onClick={() => setMessage("")} type="button">×</button></div> : null}
      {error ? <div className="form-alert" role="alert">{error}</div> : null}

      <div className="invoice-detail-layout">
        <article className="panel saved-invoice" aria-labelledby="saved-invoice-title">
          <div className="saved-invoice-brand"><div><span className="brand-mark">N</span><div><strong>{business?.name || "Your business"}</strong><small>{business?.registrationNumber ? `Registration: ${business.registrationNumber}` : "Business registration not provided"}</small><small>{business?.tin ? `TIN: ${business.tin}` : "Seller TIN not provided"}</small></div></div><div><FileText aria-hidden="true" size={22} /><span>Invoice</span></div></div>

          <div className="saved-invoice-parties"><section><span>Bill to</span><h2 id="saved-invoice-title">{invoice.customerName}</h2><p>{invoice.customerEmail || "Customer email not provided"}</p><p>{invoice.buyerTin ? `TIN: ${invoice.buyerTin}` : "Buyer TIN not provided"}</p></section><dl><div><dt>Invoice number</dt><dd>{invoice.invoiceNumber}</dd></div><div><dt>Issue date</dt><dd>{dateFormatter.format(parseLocalDate(invoice.issueDate))}</dd></div><div><dt>Due date</dt><dd>{dateFormatter.format(parseLocalDate(invoice.dueDate))}</dd></div><div><dt>Status</dt><dd><span className={`status-badge ${effectiveStatus}`}>{invoiceStatusLabels[effectiveStatus]}</span></dd></div></dl></div>

          <div className="saved-invoice-items"><div className="saved-item-row saved-item-heading"><span>Description</span><span>Qty</span><span>Unit price</span><span>Tax</span><span>Amount</span></div>{invoice.items.map((item) => <div className="saved-item-row" key={item.id}><span><strong>{item.description}</strong><small>{item.quantity} × RM{item.unitPrice.toFixed(2)} · {item.taxRate}% tax</small></span><span>{item.quantity}</span><MoneyDisplay amount={item.unitPrice} /><span>{item.taxRate}%</span><MoneyDisplay amount={item.quantity * item.unitPrice} /></div>)}</div>

          <div className="saved-invoice-footer"><div>{invoice.notes ? <section><h3>Notes</h3><p>{invoice.notes}</p></section> : null}{invoice.paymentTerms ? <section><h3>Payment terms</h3><p>{invoice.paymentTerms}</p></section> : null}</div><dl><div><dt>Subtotal</dt><dd><MoneyDisplay amount={invoice.subtotal} /></dd></div><div><dt>Tax</dt><dd><MoneyDisplay amount={invoice.tax} /></dd></div><div className="invoice-total"><dt>Total</dt><dd><MoneyDisplay amount={invoice.total} /></dd></div></dl></div>
          <p className="invoice-local-disclosure">Browser-local invoice preview only. This invoice has not been submitted to MyInvois.</p>
        </article>

        <aside className="invoice-detail-sidebar">
          <section className="panel invoice-status-panel"><p className="section-kicker">Payment tracking</p><h2>Invoice status</h2><label htmlFor="invoice-detail-status">Update status</label><select className={`invoice-status-select ${effectiveStatus}`} disabled={updateInvoice.isPending} id="invoice-detail-status" onChange={(event) => changeStatus(event.target.value as InvoiceStatus)} value={effectiveStatus}>{effectiveStatus === "overdue" ? <option disabled value="overdue">Overdue</option> : null}{(["draft", "sent", "partially_paid", "paid", "void"] as InvoiceStatus[]).map((value) => <option key={value} value={value}>{invoiceStatusLabels[value]}</option>)}</select><p>Overdue status is automatically shown when a sent invoice passes its due date.</p></section>
          <section className="panel invoice-history-panel"><p className="section-kicker">Local record</p><h2>Invoice history</h2><dl><div><dt>Created</dt><dd>{dateTimeFormatter.format(new Date(invoice.createdAt))}</dd></div><div><dt>Last updated</dt><dd>{dateTimeFormatter.format(new Date(invoice.updatedAt))}</dd></div><div><dt>Record ID</dt><dd className="record-id">{invoice.id}</dd></div></dl><button className="button button-danger button-full" onClick={() => setConfirmDelete(true)} type="button"><Trash2 aria-hidden="true" size={17} />Delete invoice</button></section>
        </aside>
      </div>

      <ConfirmationDialog danger confirmLabel={deleteInvoice.isPending ? "Deleting…" : "Delete invoice"} description={`Delete ${invoice.invoiceNumber} for ${invoice.customerName}? This permanently removes the invoice and its reminder history from this device.`} onCancel={() => setConfirmDelete(false)} onConfirm={remove} open={confirmDelete} pending={deleteInvoice.isPending} title="Delete this invoice?" />
    </>
  );
}
