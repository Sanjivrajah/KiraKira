"use client";

import Link from "next/link";
import { BellRing, CheckCircle2, Clock3, Eye, FilePlus2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { MoneyDisplay } from "@/components/shared/money-display";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { useInvoices } from "@/hooks/use-invoices";
import { useMarkReminderSent, useReminders } from "@/hooks/use-reminders";
import { daysFromDueDate, getEffectiveInvoiceStatus, parseLocalDate } from "@/lib/invoices/calculations";
import { useNiagaStore } from "@/store/use-niaga-store";
import type { Invoice } from "@/types";

const dateFormatter = new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "long", year: "numeric" });
const moneyFormatter = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", minimumFractionDigits: 0, maximumFractionDigits: 2 });
const noInvoices: Invoice[] = [];

export function makeReminderMessage(invoice: Invoice) {
  return `Hi ${invoice.customerName}, this is a friendly reminder that Invoice ${invoice.invoiceNumber} for ${moneyFormatter.format(invoice.total)} ${daysFromDueDate(invoice.dueDate) > 0 ? "was due" : "is due"} on ${dateFormatter.format(parseLocalDate(invoice.dueDate))}. Please let us know if you need another copy of the invoice.`;
}

export function ReminderList() {
  const businessId = useNiagaStore((state) => state.business?.id) || "business_demo";
  const invoicesQuery = useInvoices(businessId);
  const remindersQuery = useReminders(businessId);
  const markReminderSent = useMarkReminderSent();
  const invoices = invoicesQuery.data ?? noInvoices;
  const reminders = remindersQuery.data ?? [];
  const [preview, setPreview] = useState<Invoice | null>(null);
  const [message, setMessage] = useState("");
  const [mutationError, setMutationError] = useState("");
  const dueInvoices = useMemo(() => invoices
    .filter((invoice) => {
      const effective = getEffectiveInvoiceStatus(invoice);
      return effective === "sent" || effective === "overdue";
    })
    .sort((a, b) => {
      const aDays = daysFromDueDate(a.dueDate);
      const bDays = daysFromDueDate(b.dueDate);
      if ((aDays > 0) !== (bDays > 0)) return aDays > 0 ? -1 : 1;
      return bDays - aDays;
    }), [invoices]);

  const markReminded = async (invoice: Invoice) => {
    const sentAt = new Date().toISOString();
    const messagePreview = makeReminderMessage(invoice);
    setMessage("");
    setMutationError("");
    try {
      await markReminderSent.mutateAsync({ invoice, messagePreview, sentAt });
      setMessage(`${invoice.invoiceNumber} marked as reminded. No message was sent.`);
      setPreview(null);
    } catch {
      setMutationError("We could not save that reminder status. Please try again.");
    }
  };

  const overdueCount = dueInvoices.filter((invoice) => daysFromDueDate(invoice.dueDate) > 0).length;
  const upcomingCount = dueInvoices.length - overdueCount;

  return (
    <>
      <PageHeader eyebrow="Friendly follow-ups" title="Payment reminders" description="Review upcoming and overdue invoices, then preview a message before recording your follow-up." action={<Link className="button button-secondary" href="/invoices"><BellRing aria-hidden="true" size={18} />View invoices</Link>} />
      {invoicesQuery.isPending || remindersQuery.isPending ? <LoadingState label="Loading payment reminders" /> : null}
      {invoicesQuery.isError || remindersQuery.isError ? <><ErrorState title="We could not load payment reminders" description="Your invoice and reminder records are still on this device. Try loading them again." /><button className="button button-secondary" onClick={() => { invoicesQuery.refetch(); remindersQuery.refetch(); }} type="button">Try again</button></> : null}
      {invoicesQuery.isSuccess && remindersQuery.isSuccess ? <>
      {message ? <div className="inline-success" role="status"><CheckCircle2 aria-hidden="true" size={18} />{message}<button aria-label="Dismiss message" onClick={() => setMessage("")} type="button">×</button></div> : null}
      {mutationError ? <div className="form-alert" role="alert">{mutationError}</div> : null}
      <section className="reminder-summary" aria-label="Reminder summary"><article><span className="overdue-dot" /><div><strong>{overdueCount}</strong><span>Overdue</span></div></article><article><span className="upcoming-dot" /><div><strong>{upcomingCount}</strong><span>Upcoming</span></div></article><p><Clock3 aria-hidden="true" size={17} />Message previews are local only. Nothing is sent from this demo.</p></section>

      {dueInvoices.length === 0 ? <section className="transaction-empty panel"><h2>No payment reminders</h2><p>Sent invoices that are upcoming or overdue will appear here.</p><Link className="button button-primary" href="/invoices/new"><FilePlus2 aria-hidden="true" size={18} />Create invoice</Link></section> : <div className="reminder-grid">{dueInvoices.map((invoice) => {
        const days = daysFromDueDate(invoice.dueDate);
        const reminder = reminders.find((item) => item.invoiceId === invoice.id);
        return <article className={`reminder-card ${days > 0 ? "overdue" : "upcoming"}`} key={invoice.id}><div className="reminder-card-top"><span className={`status-badge ${days > 0 ? "overdue" : "sent"}`}>{days > 0 ? "Overdue" : "Upcoming"}</span><span className={`reminder-state ${reminder ? "done" : ""}`}>{reminder ? "Reminded" : "Not reminded"}</span></div><h2>{invoice.customerName}</h2><p className="reminder-invoice-number">{invoice.invoiceNumber}</p><MoneyDisplay amount={invoice.total} /><dl><div><dt>Due date</dt><dd>{dateFormatter.format(parseLocalDate(invoice.dueDate))}</dd></div><div><dt>{days > 0 ? "Days overdue" : "Time remaining"}</dt><dd>{days > 0 ? `${days} ${days === 1 ? "day" : "days"}` : days === 0 ? "Due today" : `${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"}`}</dd></div></dl>{reminder?.sentAt ? <p className="last-reminded"><CheckCircle2 aria-hidden="true" size={15} />Marked {dateFormatter.format(new Date(reminder.sentAt))}</p> : null}<div className="reminder-actions"><button className="button button-secondary" disabled={markReminderSent.isPending} onClick={() => setPreview(invoice)} type="button"><Eye aria-hidden="true" size={17} />Preview message</button><button className="button button-primary" disabled={markReminderSent.isPending} onClick={() => markReminded(invoice)} type="button"><CheckCircle2 aria-hidden="true" size={17} />{reminder ? "Mark again" : "Mark as reminded"}</button></div></article>;
      })}</div>}

      {preview ? <div className="dialog-backdrop" onMouseDown={() => setPreview(null)}><section aria-describedby="reminder-preview-description" aria-labelledby="reminder-preview-title" aria-modal="true" className="dialog-panel reminder-preview-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog"><button aria-label="Close reminder preview" className="dialog-close" disabled={markReminderSent.isPending} onClick={() => setPreview(null)} type="button"><X aria-hidden="true" size={19} /></button><p className="section-kicker">Message preview</p><h2 id="reminder-preview-title">Friendly payment reminder</h2><p id="reminder-preview-description">Review the wording below. This preview will not be sent.</p><blockquote>{makeReminderMessage(preview)}</blockquote><div className="dialog-actions"><button className="button button-secondary" disabled={markReminderSent.isPending} onClick={() => setPreview(null)} type="button">Close</button><button className="button button-primary" disabled={markReminderSent.isPending} onClick={() => markReminded(preview)} type="button"><CheckCircle2 aria-hidden="true" size={17} />Mark as reminded</button></div></section></div> : null}
      </> : null}
    </>
  );
}
