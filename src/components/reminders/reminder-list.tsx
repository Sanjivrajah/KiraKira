"use client";

import Link from "next/link";
import { BellRing, CheckCircle2, Clock3, Eye, FilePlus2, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { MoneyDisplay } from "@/components/shared/money-display";
import { PageHeader } from "@/components/shared/page-header";
import { mockInvoices } from "@/data/mock-invoices";
import { daysFromDueDate, getEffectiveInvoiceStatus, parseLocalDate } from "@/lib/invoices/calculations";
import { initializeInvoices } from "@/lib/invoices/storage";
import { getReminders, markInvoiceReminded } from "@/lib/reminders/storage";
import { useDialogFocus } from "@/hooks/use-dialog-focus";
import type { Invoice, InvoiceReminder } from "@/types/finance";

const dateFormatter = new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "long", year: "numeric" });
const moneyFormatter = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function makeReminderMessage(invoice: Invoice) {
  return `Hi ${invoice.customerName}, this is a friendly reminder that Invoice ${invoice.invoiceNumber} for ${moneyFormatter.format(invoice.total)} ${daysFromDueDate(invoice.dueDate) > 0 ? "was due" : "is due"} on ${dateFormatter.format(parseLocalDate(invoice.dueDate))}. Please let us know if you need another copy of the invoice.`;
}

export function ReminderList() {
  const [invoices] = useState<Invoice[]>(() => initializeInvoices(mockInvoices));
  const [reminders, setReminders] = useState<InvoiceReminder[]>(() => getReminders());
  const [preview, setPreview] = useState<Invoice | null>(null);
  const [message, setMessage] = useState("");
  const closePreview = useCallback(() => setPreview(null), []);
  const previewRef = useDialogFocus<HTMLElement>(preview !== null, closePreview);

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

  const markReminded = (invoice: Invoice) => {
    const remindedAt = new Date().toISOString();
    if (!markInvoiceReminded(invoice.id, remindedAt)) {
      setMessage("We could not save that reminder status. Please try again.");
      return;
    }
    setReminders((current) => [{ invoiceId: invoice.id, remindedAt }, ...current.filter((item) => item.invoiceId !== invoice.id)]);
    setMessage(`${invoice.invoiceNumber} marked as reminded. No message was sent.`);
    setPreview(null);
  };

  const overdueCount = dueInvoices.filter((invoice) => daysFromDueDate(invoice.dueDate) > 0).length;
  const upcomingCount = dueInvoices.length - overdueCount;

  return (
    <>
      <PageHeader eyebrow="Friendly follow-ups" title="Payment reminders" description="Review upcoming and overdue invoices, then preview a message before recording your follow-up." action={<Link className="button button-secondary" href="/invoices"><BellRing aria-hidden="true" size={18} />View invoices</Link>} />
      {message ? <div className="inline-success" role="status"><CheckCircle2 aria-hidden="true" size={18} />{message}<button aria-label="Dismiss message" onClick={() => setMessage("")} type="button">×</button></div> : null}
      <section className="reminder-summary" aria-label="Reminder summary"><article><span className="overdue-dot" /><div><strong>{overdueCount}</strong><span>Overdue</span></div></article><article><span className="upcoming-dot" /><div><strong>{upcomingCount}</strong><span>Upcoming</span></div></article><p><Clock3 aria-hidden="true" size={17} />Message previews are local only. Nothing is sent from this demo.</p></section>

      {dueInvoices.length === 0 ? <section className="transaction-empty panel"><h2>No payment reminders</h2><p>Sent invoices that are upcoming or overdue will appear here.</p><Link className="button button-primary" href="/invoices/new"><FilePlus2 aria-hidden="true" size={18} />Create invoice</Link></section> : <div className="reminder-grid">{dueInvoices.map((invoice) => {
        const days = daysFromDueDate(invoice.dueDate);
        const reminder = reminders.find((item) => item.invoiceId === invoice.id);
        return <article className={`reminder-card ${days > 0 ? "overdue" : "upcoming"}`} key={invoice.id}><div className="reminder-card-top"><span className={`status-badge ${days > 0 ? "overdue" : "sent"}`}>{days > 0 ? "Overdue" : "Upcoming"}</span><span className={`reminder-state ${reminder ? "done" : ""}`}>{reminder ? "Reminded" : "Not reminded"}</span></div><h2>{invoice.customerName}</h2><p className="reminder-invoice-number">{invoice.invoiceNumber}</p><MoneyDisplay amount={invoice.total} /><dl><div><dt>Due date</dt><dd>{dateFormatter.format(parseLocalDate(invoice.dueDate))}</dd></div><div><dt>{days > 0 ? "Days overdue" : "Time remaining"}</dt><dd>{days > 0 ? `${days} ${days === 1 ? "day" : "days"}` : days === 0 ? "Due today" : `${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"}`}</dd></div></dl>{reminder ? <p className="last-reminded"><CheckCircle2 aria-hidden="true" size={15} />Marked {dateFormatter.format(new Date(reminder.remindedAt))}</p> : null}<div className="reminder-actions"><button className="button button-secondary" onClick={() => setPreview(invoice)} type="button"><Eye aria-hidden="true" size={17} />Preview message</button><button className="button button-primary" onClick={() => markReminded(invoice)} type="button"><CheckCircle2 aria-hidden="true" size={17} />{reminder ? "Mark again" : "Mark as reminded"}</button></div></article>;
      })}</div>}

      {preview ? <div className="dialog-backdrop" onMouseDown={closePreview}><section aria-describedby="reminder-preview-description" aria-labelledby="reminder-preview-title" aria-modal="true" className="dialog-panel reminder-preview-dialog" onMouseDown={(event) => event.stopPropagation()} ref={previewRef} role="dialog" tabIndex={-1}><button aria-label="Close reminder preview" className="dialog-close" onClick={closePreview} type="button"><X aria-hidden="true" size={19} /></button><p className="section-kicker">Message preview</p><h2 id="reminder-preview-title">Friendly payment reminder</h2><p id="reminder-preview-description">Review the wording below. This preview will not be sent.</p><blockquote>{makeReminderMessage(preview)}</blockquote><div className="dialog-actions"><button className="button button-secondary" onClick={closePreview} type="button">Close</button><button className="button button-primary" onClick={() => markReminded(preview)} type="button"><CheckCircle2 aria-hidden="true" size={17} />Mark as reminded</button></div></section></div> : null}
    </>
  );
}
