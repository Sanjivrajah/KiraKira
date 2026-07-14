"use client";

import Link from "next/link";
import { CheckCircle2, ChevronRight, FilePlus2, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MoneyDisplay } from "@/components/shared/money-display";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { useInvoices, useUpdateInvoice } from "@/hooks/use-invoices";
import { useBusiness } from "@/hooks/use-business";
import { getEffectiveInvoiceStatus, parseLocalDate } from "@/lib/invoices/calculations";
import type { EffectiveInvoiceStatus, Invoice, InvoiceStatus } from "@/types";
import { DEMO_BUSINESS } from "@/data/demo";

export const invoiceStatusLabels: Record<EffectiveInvoiceStatus, string> = {
  draft: "Draft", sent: "Sent", partially_paid: "Partially paid", paid: "Paid", void: "Void", overdue: "Overdue",
};
const persistedStatusOptions: InvoiceStatus[] = ["draft", "sent", "partially_paid", "paid", "void"];

const dateFormatter = new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", year: "numeric" });
const displayDate = (date: string) => dateFormatter.format(parseLocalDate(date));
const noInvoices: Invoice[] = [];

export function InvoiceList({ initialMessage = "" }: { initialMessage?: string }) {
  const businessId = useBusiness().data?.id || DEMO_BUSINESS.id;
  const invoicesQuery = useInvoices(businessId);
  const updateInvoice = useUpdateInvoice();
  const invoices = invoicesQuery.data ?? noInvoices;
  const [status, setStatus] = useState<EffectiveInvoiceStatus | "all">("all");
  const [customer, setCustomer] = useState("");
  const [message, setMessage] = useState(initialMessage);
  const [mutationError, setMutationError] = useState("");

  useEffect(() => {
    if (initialMessage) window.history.replaceState(null, "", "/invoices");
  }, [initialMessage]);
  const visible = useMemo(() => invoices
    .filter((invoice) => status === "all" || getEffectiveInvoiceStatus(invoice) === status)
    .filter((invoice) => invoice.customerName.toLowerCase().includes(customer.trim().toLowerCase()))
    .sort((a, b) => b.issueDate.localeCompare(a.issueDate)), [customer, invoices, status]);

  const changeStatus = async (invoice: Invoice, nextStatus: InvoiceStatus) => {
    const updated = { ...invoice, status: nextStatus, updatedAt: new Date().toISOString() };
    setMessage("");
    setMutationError("");
    try {
      await updateInvoice.mutateAsync(updated);
      setMessage(`${invoice.invoiceNumber} marked as ${invoiceStatusLabels[nextStatus].toLowerCase()}.`);
    } catch {
      setMutationError("We could not save that status. Please try again.");
    }
  };

  return (
    <>
      <PageHeader eyebrow="Get paid" title="Invoices" description="Create clear payment requests and track every customer balance." action={<Link className="button button-primary" href="/invoices/new"><FilePlus2 aria-hidden="true" size={18} />Create invoice</Link>} />
      {invoicesQuery.isPending ? <LoadingState label="Loading invoices" /> : null}
      {invoicesQuery.isError ? <><ErrorState title="We could not load your invoices" description="Your invoices are still on this device. Try loading them again." /><button className="button button-secondary" onClick={() => invoicesQuery.refetch()} type="button">Try again</button></> : null}
      {message ? <div className="inline-success" role="status"><CheckCircle2 aria-hidden="true" size={18} />{message}<button aria-label="Dismiss message" onClick={() => setMessage("")} type="button">×</button></div> : null}
      {mutationError ? <div className="form-alert" role="alert">{mutationError}</div> : null}

      {invoicesQuery.isSuccess ? <><section className="invoice-toolbar" aria-label="Invoice filters">
        <label className="transaction-search"><Search aria-hidden="true" size={18} /><span className="sr-only">Filter by customer name</span><input onChange={(event) => setCustomer(event.target.value)} placeholder="Filter by customer name" type="search" value={customer} /></label>
        <label><span>Status</span><select onChange={(event) => setStatus(event.target.value as EffectiveInvoiceStatus | "all")} value={status}><option value="all">All statuses</option>{Object.entries(invoiceStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </section>

      <div className="transaction-results-heading"><p><strong>{visible.length}</strong> {visible.length === 1 ? "invoice" : "invoices"}</p><span className="all-reviewed">Stored on this device</span></div>
      {visible.length === 0 ? (
        <section className="transaction-empty panel"><h2>{invoices.length ? "No matching invoices" : "No invoices yet"}</h2><p>{invoices.length ? "Try changing the customer or status filter." : "Create your first invoice to start tracking customer payments."}</p>{invoices.length ? <button className="button button-secondary" onClick={() => { setCustomer(""); setStatus("all"); }} type="button">Clear filters</button> : <Link className="button button-primary" href="/invoices/new">Create invoice</Link>}</section>
      ) : (
        <>
          <div className="invoice-table-wrap panel"><table className="invoice-table"><thead><tr><th>Invoice</th><th>Customer</th><th>Issue date</th><th>Due date</th><th>Status</th><th>Total</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visible.map((invoice) => { const effective = getEffectiveInvoiceStatus(invoice); return <tr key={invoice.id}><td><Link href={`/invoices/${invoice.id}`}><strong>{invoice.invoiceNumber}</strong></Link></td><td><Link href={`/invoices/${invoice.id}`}>{invoice.customerName}</Link></td><td>{displayDate(invoice.issueDate)}</td><td>{displayDate(invoice.dueDate)}</td><td><select aria-label={`Status for ${invoice.invoiceNumber}`} className={`invoice-status-select ${effective}`} onChange={(event) => changeStatus(invoice, event.target.value as InvoiceStatus)} value={effective}>{effective === "overdue" ? <option disabled value="overdue">Overdue</option> : null}{persistedStatusOptions.map((value) => <option key={value} value={value}>{invoiceStatusLabels[value]}</option>)}</select></td><td><MoneyDisplay amount={invoice.total} /></td><td><Link aria-label={`View ${invoice.invoiceNumber}`} className="row-link" href={`/invoices/${invoice.id}`}><ChevronRight aria-hidden="true" size={18} /></Link></td></tr>; })}</tbody></table></div>
          <div className="invoice-cards">{visible.map((invoice) => { const effective = getEffectiveInvoiceStatus(invoice); return <article className="invoice-card" key={invoice.id}><Link className="invoice-card-link" href={`/invoices/${invoice.id}`}><div className="invoice-card-heading"><div><span>{invoice.invoiceNumber}</span><h2>{invoice.customerName}</h2></div><MoneyDisplay amount={invoice.total} /></div><dl><div><dt>Issued</dt><dd>{displayDate(invoice.issueDate)}</dd></div><div><dt>Due</dt><dd>{displayDate(invoice.dueDate)}</dd></div></dl></Link><div className="invoice-card-actions"><label><span className="sr-only">Status for {invoice.invoiceNumber}</span><select className={`invoice-status-select ${effective}`} onChange={(event) => changeStatus(invoice, event.target.value as InvoiceStatus)} value={effective}>{effective === "overdue" ? <option disabled value="overdue">Overdue</option> : null}{persistedStatusOptions.map((value) => <option key={value} value={value}>{invoiceStatusLabels[value]}</option>)}</select></label><Link href={`/invoices/${invoice.id}`}>View invoice<ChevronRight aria-hidden="true" size={16} /></Link></div></article>; })}</div>
        </>
      )}</> : null}
    </>
  );
}
