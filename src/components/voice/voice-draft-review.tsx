"use client";

import { CheckCircle2, Loader2, Receipt, Trash2 } from "lucide-react";
import { useState } from "react";
import { MoneyDisplay } from "@/components/shared/money-display";
import { calculateInvoiceTotals } from "@/lib/invoices/calculations";
import { formatMoney } from "@/lib/format/money";
import { makeEntityId } from "@/services/id";
import { useCreateInvoice } from "@/hooks/use-invoices";
import { useCreateTransaction } from "@/hooks/use-transactions";
import { useAuth } from "@/components/auth/auth-provider";
import { useBusiness } from "@/hooks/use-business";
import { useVoiceDraftStore } from "./voice-draft-store";

export function VoiceDraftReview() {
  const { session } = useAuth();
  const { data: business } = useBusiness();
  const transaction = useVoiceDraftStore((state) => state.transaction);
  const invoice = useVoiceDraftStore((state) => state.invoice);
  const reminder = useVoiceDraftStore((state) => state.reminder);
  const lastConfirmation = useVoiceDraftStore((state) => state.lastConfirmation);
  const patchTransaction = useVoiceDraftStore((state) => state.patchTransaction);
  const clearTransaction = useVoiceDraftStore((state) => state.clearTransaction);
  const clearInvoice = useVoiceDraftStore((state) => state.clearInvoice);
  const setReminder = useVoiceDraftStore((state) => state.setReminder);
  const setLastConfirmation = useVoiceDraftStore((state) => state.setLastConfirmation);

  const createTransaction = useCreateTransaction();
  const createInvoice = useCreateInvoice();
  const [error, setError] = useState("");

  const businessId = business?.id ?? null;
  const createdBy = session?.user.id ?? "";

  const confirmTransaction = async () => {
    if (!transaction || !businessId) return;
    if (transaction.amount === null) {
      setError("Enter an amount before saving.");
      return;
    }
    setError("");
    try {
      const created = await createTransaction.mutateAsync({
        businessId,
        createdBy,
        type: transaction.type,
        subtotal: transaction.amount,
        tax: 0,
        total: transaction.amount,
        currency: "MYR",
        date: transaction.date,
        category: transaction.category,
        description: transaction.description,
        counterpartyName: transaction.counterpartyName,
        paymentMethod: transaction.paymentMethod || null,
        sourceType: "voice",
        status: "confirmed",
        items: [],
      });
      clearTransaction();
      setLastConfirmation({ kind: "transaction", label: `${formatMoney(created.total)} ${created.type === "income" ? "money in" : "money out"}` });
    } catch {
      setError("We couldn't save this record. Please try again.");
    }
  };

  const confirmInvoice = async () => {
    if (!invoice || !businessId) return;
    setError("");
    try {
      const created = await createInvoice.mutateAsync({
        businessId,
        customerId: null,
        invoiceNumber: makeEntityId("INV").toUpperCase().slice(0, 16),
        customerName: invoice.customerName,
        customerEmail: invoice.customerEmail,
        buyerTin: null,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        status: "draft",
        currency: "MYR",
        items: invoice.items.map((item) => ({
          id: makeEntityId("ili"),
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
        })),
        amountPaid: 0,
        notes: invoice.notes,
        paymentTerms: null,
      });
      clearInvoice();
      setLastConfirmation({ kind: "invoice", label: `${created.invoiceNumber} for ${created.customerName}` });
    } catch {
      setError("We couldn't save this invoice. Please try again.");
    }
  };

  const savingTransaction = createTransaction.isPending;
  const savingInvoice = createInvoice.isPending;
  const invoiceTotals = invoice ? calculateInvoiceTotals(invoice.items) : null;

  if (!transaction && !invoice && !reminder && !lastConfirmation) {
    return (
      <div className="voice-draft-empty" aria-live="polite">
        <Receipt aria-hidden="true" size={20} />
        <p>Anything you dictate appears here for you to review. Nothing is saved until you confirm.</p>
      </div>
    );
  }

  return (
    <div className="voice-draft-stack" aria-live="polite">
      {lastConfirmation ? (
        <div className="voice-confirmation" role="status">
          <CheckCircle2 aria-hidden="true" size={18} />
          <span>Saved {lastConfirmation.kind === "transaction" ? "record" : "invoice"}: {lastConfirmation.label}</span>
        </div>
      ) : null}

      {transaction ? (
        <section className="voice-draft-card" aria-labelledby="voice-tx-title">
          <header>
            <span className="voice-draft-tag">Transaction draft</span>
            <h3 id="voice-tx-title">Review before saving</h3>
          </header>
          <div className="voice-draft-grid">
            <label>Money in or out
              <select value={transaction.type} onChange={(event) => patchTransaction({ type: event.target.value as "income" | "expense" })}>
                <option value="income">Money in</option>
                <option value="expense">Money out</option>
              </select>
            </label>
            <label>Amount (RM)
              <input inputMode="decimal" min="0.01" step="0.01" type="number" value={transaction.amount ?? ""}
                onChange={(event) => patchTransaction({ amount: event.target.value === "" ? null : Number(event.target.value) })} />
            </label>
            <label>Date
              <input type="date" value={transaction.date} onChange={(event) => patchTransaction({ date: event.target.value })} />
            </label>
            <label>Category
              <input maxLength={60} type="text" value={transaction.category} onChange={(event) => patchTransaction({ category: event.target.value })} />
            </label>
            <label className="voice-draft-wide">Description
              <input maxLength={160} type="text" value={transaction.description} onChange={(event) => patchTransaction({ description: event.target.value })} />
            </label>
            <label>Merchant or customer
              <input maxLength={100} type="text" value={transaction.counterpartyName} onChange={(event) => patchTransaction({ counterpartyName: event.target.value })} />
            </label>
            <label>Payment method
              <input maxLength={60} type="text" value={transaction.paymentMethod} onChange={(event) => patchTransaction({ paymentMethod: event.target.value })} />
            </label>
          </div>
          {error ? <p className="form-alert" role="alert">{error}</p> : null}
          <div className="voice-draft-actions">
            <button className="button button-secondary" disabled={savingTransaction} onClick={clearTransaction} type="button">
              <Trash2 aria-hidden="true" size={16} />Discard
            </button>
            <button className="button button-primary" disabled={savingTransaction} onClick={confirmTransaction} type="button">
              {savingTransaction ? <Loader2 aria-hidden="true" className="spin" size={16} /> : <CheckCircle2 aria-hidden="true" size={16} />}
              Save record
            </button>
          </div>
        </section>
      ) : null}

      {invoice ? (
        <section className="voice-draft-card" aria-labelledby="voice-inv-title">
          <header>
            <span className="voice-draft-tag">Invoice draft</span>
            <h3 id="voice-inv-title">{invoice.customerName}</h3>
          </header>
          <ul className="voice-invoice-lines">
            {invoice.items.map((item, index) => (
              <li key={`${item.description}-${index}`}>
                <span>{item.quantity} × {item.description}</span>
                <MoneyDisplay amount={item.quantity * item.unitPrice * (1 + item.taxRate / 100)} />
              </li>
            ))}
          </ul>
          {invoiceTotals ? (
            <p className="voice-invoice-total">Total <strong><MoneyDisplay amount={invoiceTotals.total} /></strong> · due {invoice.dueDate}</p>
          ) : null}
          {error ? <p className="form-alert" role="alert">{error}</p> : null}
          <div className="voice-draft-actions">
            <button className="button button-secondary" disabled={savingInvoice} onClick={clearInvoice} type="button">
              <Trash2 aria-hidden="true" size={16} />Discard
            </button>
            <button className="button button-primary" disabled={savingInvoice} onClick={confirmInvoice} type="button">
              {savingInvoice ? <Loader2 aria-hidden="true" className="spin" size={16} /> : <CheckCircle2 aria-hidden="true" size={16} />}
              Save draft invoice
            </button>
          </div>
        </section>
      ) : null}

      {reminder ? (
        <section className="voice-draft-card" aria-labelledby="voice-reminder-title">
          <header>
            <span className="voice-draft-tag">Reminder draft</span>
            <h3 id="voice-reminder-title">For {reminder.customerName}</h3>
          </header>
          <p className="voice-reminder-message">{reminder.message}</p>
          <p className="voice-draft-note">Sending reminders isn&apos;t connected in this demo.</p>
          <div className="voice-draft-actions">
            <button className="button button-secondary" onClick={() => setReminder(null)} type="button">
              <Trash2 aria-hidden="true" size={16} />Dismiss
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
