"use client";

import { AlertTriangle, CheckCircle2, ChevronDown, FileCheck2, Loader2, Receipt, Send, Trash2, UserPlus, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { MoneyDisplay } from "@/components/shared/money-display";
import { calculateInvoiceTotals } from "@/lib/invoices/calculations";
import { formatMoney } from "@/lib/format/money";
import { makeEntityId } from "@/services/id";
import { services } from "@/services";
import { useCreateInvoice, useUpdateInvoice } from "@/hooks/use-invoices";
import { useCreateTransaction, useDeleteTransaction, useUpdateTransaction } from "@/hooks/use-transactions";
import { useMarkReminderSent } from "@/hooks/use-reminders";
import { useAuth } from "@/components/auth/auth-provider";
import { useBusiness } from "@/hooks/use-business";
import { useVoiceDraftStore } from "./voice-draft-store";
import { createVoiceCustomerResolver } from "./voice-customers";
import { computeTransactionTotals } from "./voice-finance";

export function VoiceDraftReview() {
  const { session, mode } = useAuth();
  const { data: business } = useBusiness();
  const transaction = useVoiceDraftStore((state) => state.transaction);
  const invoice = useVoiceDraftStore((state) => state.invoice);
  const reminder = useVoiceDraftStore((state) => state.reminder);
  const pendingDelete = useVoiceDraftStore((state) => state.pendingDelete);
  const pendingPayment = useVoiceDraftStore((state) => state.pendingPayment);
  const customer = useVoiceDraftStore((state) => state.customer);
  const lastConfirmation = useVoiceDraftStore((state) => state.lastConfirmation);
  const patchTransaction = useVoiceDraftStore((state) => state.patchTransaction);
  const clearTransaction = useVoiceDraftStore((state) => state.clearTransaction);
  const clearInvoice = useVoiceDraftStore((state) => state.clearInvoice);
  const setReminder = useVoiceDraftStore((state) => state.setReminder);
  const setPendingDelete = useVoiceDraftStore((state) => state.setPendingDelete);
  const setPendingPayment = useVoiceDraftStore((state) => state.setPendingPayment);
  const setCustomer = useVoiceDraftStore((state) => state.setCustomer);
  const setLastConfirmation = useVoiceDraftStore((state) => state.setLastConfirmation);

  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();
  const markReminderSent = useMarkReminderSent();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<null | "invoice" | "payment" | "reminder" | "customer">(null);

  const businessId = business?.id ?? null;
  const createdBy = session?.user.id ?? "";
  const customerResolver = useMemo(
    () => (businessId ? createVoiceCustomerResolver({ mode: mode ?? "demo", businessId }) : null),
    [mode, businessId],
  );

  const confirmTransaction = async () => {
    if (!transaction || !businessId) return;
    if (transaction.amount === null) {
      setError("Enter an amount before saving.");
      return;
    }
    setError("");
    const totals = computeTransactionTotals(transaction.amount, transaction.taxRate, transaction.taxInclusive);
    try {
      if (transaction.mode === "edit" && transaction.editingId && transaction.original) {
        const updated = await updateTransaction.mutateAsync({
          ...transaction.original,
          type: transaction.type,
          subtotal: totals.subtotal,
          tax: totals.tax,
          total: totals.total,
          currency: "MYR",
          date: transaction.date,
          category: transaction.category,
          description: transaction.description,
          counterpartyId: transaction.counterpartyId,
          counterpartyName: transaction.counterpartyName,
          paymentMethod: transaction.paymentMethod || null,
          notes: transaction.notes || null,
          items: [],
        });
        clearTransaction();
        setLastConfirmation({ kind: "transaction", label: `${formatMoney(updated.total)} ${updated.type === "income" ? "money in" : "money out"} (updated)` });
        return;
      }
      const created = await createTransaction.mutateAsync({
        businessId,
        createdBy,
        type: transaction.type,
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        currency: "MYR",
        date: transaction.date,
        category: transaction.category,
        description: transaction.description,
        counterpartyId: transaction.counterpartyId,
        counterpartyName: transaction.counterpartyName,
        paymentMethod: transaction.paymentMethod || null,
        notes: transaction.notes || null,
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
    setBusy("invoice");
    try {
      const invoiceNumber = await services.invoices.nextInvoiceNumber(businessId);
      const created = await createInvoice.mutateAsync({
        businessId,
        customerId: invoice.customerId,
        invoiceNumber,
        customerName: invoice.customerName,
        customerEmail: invoice.customerEmail,
        buyerTin: invoice.buyerTin,
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
          classificationCode: item.classificationCode,
          unitCode: item.unitCode,
          taxTypeCode: item.taxTypeCode,
          exemptionReason: item.exemptionReason || undefined,
          discountAmount: item.discountAmount,
          chargeAmount: item.chargeAmount,
        })),
        amountPaid: 0,
        prepaymentAmount: invoice.prepaymentAmount,
        notes: invoice.notes,
        paymentTerms: invoice.paymentTerms,
      });
      clearInvoice();
      setLastConfirmation({ kind: "invoice", label: `${created.invoiceNumber} for ${created.customerName}` });
    } catch {
      setError("We couldn't save this invoice. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete || !businessId) return;
    setError("");
    try {
      await deleteTransaction.mutateAsync({ businessId, transactionId: pendingDelete.id });
      setPendingDelete(null);
      setLastConfirmation({ kind: "delete", label: pendingDelete.label });
    } catch {
      setError("We couldn't delete that record. Please try again.");
    }
  };

  const confirmPayment = async () => {
    if (!pendingPayment || !businessId) return;
    setError("");
    setBusy("payment");
    try {
      const target = await services.invoices.getById(businessId, pendingPayment.invoiceId);
      if (!target) {
        setError("We couldn't find that invoice.");
        return;
      }
      const newPaid = Math.round((Math.min(target.amountPaid + pendingPayment.amount, target.total) + Number.EPSILON) * 100) / 100;
      const status = newPaid + 0.005 >= target.total ? "paid" : "partially_paid";
      await updateInvoice.mutateAsync({ ...target, amountPaid: newPaid, status });
      setPendingPayment(null);
      setLastConfirmation({ kind: "payment", label: `${formatMoney(pendingPayment.amount)} to ${target.invoiceNumber}` });
    } catch {
      setError("We couldn't record that payment. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const confirmReminder = async () => {
    if (!reminder || !businessId) return;
    setError("");
    setBusy("reminder");
    try {
      const target = await services.invoices.getById(businessId, reminder.invoiceId);
      if (!target) {
        setError("We couldn't find that invoice.");
        return;
      }
      await markReminderSent.mutateAsync({ invoice: target, messagePreview: reminder.message });
      setReminder(null);
      setLastConfirmation({ kind: "reminder", label: `${target.invoiceNumber} to ${target.customerName}` });
    } catch {
      setError("We couldn't record that reminder. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const confirmCustomer = async () => {
    if (!customer || !customerResolver) return;
    setError("");
    setBusy("customer");
    try {
      const created = await customerResolver.create({
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        tin: customer.tin,
        registrationNumber: customer.registrationNumber,
        address: customer.address,
      });
      setCustomer(null);
      setLastConfirmation({ kind: "customer", label: created.name });
    } catch {
      setError("We couldn't save this customer. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const savingTransaction = createTransaction.isPending || updateTransaction.isPending;
  const savingInvoice = busy === "invoice" || createInvoice.isPending;
  const transactionTotals = transaction && transaction.amount !== null
    ? computeTransactionTotals(transaction.amount, transaction.taxRate, transaction.taxInclusive)
    : null;
  const invoiceTotals = invoice ? calculateInvoiceTotals(invoice.items) : null;

  const confirmationLabels: Record<string, string> = {
    transaction: "record",
    invoice: "invoice",
    reminder: "reminder",
    payment: "payment",
    customer: "customer",
    delete: "deletion",
  };

  if (!transaction && !invoice && !reminder && !pendingDelete && !pendingPayment && !customer && !lastConfirmation) {
    return (
      <div className="voice-draft-empty" aria-live="polite">
        <span><Receipt aria-hidden="true" size={22} /></span>
        <div>
          <strong>Your review queue is ready</strong>
          <p>Anything you dictate appears here first. Nothing is saved until you check and confirm it.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="voice-draft-stack" aria-live="polite">
      {lastConfirmation ? (
        <div className="voice-confirmation" role="status">
          <CheckCircle2 aria-hidden="true" size={18} />
          <span>Saved {confirmationLabels[lastConfirmation.kind] ?? lastConfirmation.kind}: {lastConfirmation.label}</span>
        </div>
      ) : null}

      {transaction ? (
        <section className="voice-draft-card" aria-labelledby="voice-tx-title">
          <header>
            <div>
              <span className="voice-draft-tag">{transaction.mode === "edit" ? "Edit record" : "Transaction draft"}</span>
              <h3 id="voice-tx-title">Ready for your review</h3>
              <p>Check the prepared record before it becomes part of your books.</p>
            </div>
            <FileCheck2 aria-hidden="true" size={24} />
          </header>
          <div className="voice-draft-summary">
            <span className="voice-draft-direction" data-type={transaction.type}>{transaction.type === "income" ? "Money in" : "Money out"}</span>
            <strong>{transactionTotals ? <MoneyDisplay amount={transactionTotals.total} /> : "Amount needed"}</strong>
            <p>{transaction.description || transaction.category || "Description needed"}</p>
            <small>{transaction.date}{transaction.counterpartyName ? ` · ${transaction.counterpartyName}` : ""}</small>
            {transactionTotals && transactionTotals.tax > 0 ? (
              <small>Subtotal {formatMoney(transactionTotals.subtotal)} · Tax {formatMoney(transactionTotals.tax)}</small>
            ) : null}
            {transaction.notes ? <small className="voice-draft-notes">Note: {transaction.notes}</small> : null}
          </div>
          <details className="voice-draft-details">
            <summary>Edit details <ChevronDown aria-hidden="true" size={17} /></summary>
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
              <label>Tax rate (%)
                <input inputMode="decimal" min="0" step="0.01" type="number" value={transaction.taxRate}
                  onChange={(event) => patchTransaction({ taxRate: event.target.value === "" ? 0 : Number(event.target.value) })} />
              </label>
              <label className="voice-draft-checkbox">
                <input checked={transaction.taxInclusive} type="checkbox"
                  onChange={(event) => patchTransaction({ taxInclusive: event.target.checked })} />
                Amount includes tax
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
              <label className="voice-draft-wide">Notes
                <input maxLength={500} type="text" value={transaction.notes} onChange={(event) => patchTransaction({ notes: event.target.value })} />
              </label>
            </div>
          </details>
          {error ? <p className="form-alert" role="alert">{error}</p> : null}
          <div className="voice-draft-actions">
            <button className="button button-secondary" disabled={savingTransaction} onClick={clearTransaction} type="button">
              <Trash2 aria-hidden="true" size={16} />Discard
            </button>
            <button className="button button-primary" disabled={savingTransaction} onClick={confirmTransaction} type="button">
              {savingTransaction ? <Loader2 aria-hidden="true" className="spin" size={16} /> : <CheckCircle2 aria-hidden="true" size={16} />}
              {transaction.mode === "edit" ? "Save changes" : "Save record"}
            </button>
          </div>
        </section>
      ) : null}

      {invoice ? (
        <section className="voice-draft-card" aria-labelledby="voice-inv-title">
          <header>
            <div>
              <span className="voice-draft-tag">Invoice draft</span>
              <h3 id="voice-inv-title">Ready for your review</h3>
              <p>Check the customer, total, and e-invoice details before saving the draft.</p>
            </div>
            <FileCheck2 aria-hidden="true" size={24} />
          </header>
          <div className="voice-draft-summary">
            <span className="voice-draft-direction">Draft invoice</span>
            <strong>{invoiceTotals ? <MoneyDisplay amount={invoiceTotals.total} /> : "Total pending"}</strong>
            <p>{invoice.customerName}</p>
            <small>Due {invoice.dueDate}{invoice.buyerTin ? ` · Buyer TIN ${invoice.buyerTin}` : " · No buyer TIN"}</small>
            {invoiceTotals && invoiceTotals.tax > 0 ? <small>Subtotal {formatMoney(invoiceTotals.subtotal)} · Tax {formatMoney(invoiceTotals.tax)}</small> : null}
            {invoice.paymentTerms ? <small className="voice-draft-notes">{invoice.paymentTerms}</small> : null}
          </div>
          <details className="voice-draft-details">
            <summary>View line items <ChevronDown aria-hidden="true" size={17} /></summary>
            <ul className="voice-invoice-lines">
              {invoice.items.map((item, index) => (
                <li key={`${item.description}-${index}`}>
                  <span>{item.quantity} × {item.description}{item.taxRate > 0 ? ` (+${item.taxRate}% tax)` : ""}</span>
                  <MoneyDisplay amount={item.quantity * item.unitPrice * (1 + item.taxRate / 100)} />
                </li>
              ))}
            </ul>
          </details>
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

      {pendingDelete ? (
        <section className="voice-draft-card" data-variant="danger" aria-labelledby="voice-delete-title">
          <header>
            <div>
              <span className="voice-draft-tag">Delete record</span>
              <h3 id="voice-delete-title">Confirm deletion</h3>
              <p>This permanently removes the record. It can&apos;t be undone.</p>
            </div>
            <AlertTriangle aria-hidden="true" size={24} />
          </header>
          <p className="voice-reminder-message">{pendingDelete.label}</p>
          {error ? <p className="form-alert" role="alert">{error}</p> : null}
          <div className="voice-draft-actions">
            <button className="button button-secondary" disabled={deleteTransaction.isPending} onClick={() => setPendingDelete(null)} type="button">Keep it</button>
            <button className="button button-danger" disabled={deleteTransaction.isPending} onClick={confirmDelete} type="button">
              {deleteTransaction.isPending ? <Loader2 aria-hidden="true" className="spin" size={16} /> : <Trash2 aria-hidden="true" size={16} />}
              Delete record
            </button>
          </div>
        </section>
      ) : null}

      {pendingPayment ? (
        <section className="voice-draft-card" aria-labelledby="voice-payment-title">
          <header>
            <div>
              <span className="voice-draft-tag">Record payment</span>
              <h3 id="voice-payment-title">Confirm payment</h3>
              <p>Recording a payment updates the invoice status.</p>
            </div>
            <Wallet aria-hidden="true" size={24} />
          </header>
          <div className="voice-draft-summary">
            <strong><MoneyDisplay amount={pendingPayment.amount} /></strong>
            <p>{pendingPayment.customerName} · {pendingPayment.invoiceNumber}</p>
            <small>Invoice total {formatMoney(pendingPayment.total)} · already paid {formatMoney(pendingPayment.currentPaid)}</small>
          </div>
          <p className="voice-draft-note">In demo mode this updates the invoice status only; full payment records are available with a connected account.</p>
          {error ? <p className="form-alert" role="alert">{error}</p> : null}
          <div className="voice-draft-actions">
            <button className="button button-secondary" disabled={busy === "payment"} onClick={() => setPendingPayment(null)} type="button">Discard</button>
            <button className="button button-primary" disabled={busy === "payment"} onClick={confirmPayment} type="button">
              {busy === "payment" ? <Loader2 aria-hidden="true" className="spin" size={16} /> : <CheckCircle2 aria-hidden="true" size={16} />}
              Record payment
            </button>
          </div>
        </section>
      ) : null}

      {customer ? (
        <section className="voice-draft-card" aria-labelledby="voice-customer-title">
          <header>
            <div>
              <span className="voice-draft-tag">New customer</span>
              <h3 id="voice-customer-title">Confirm customer</h3>
              <p>Save this customer so you can invoice them by name.</p>
            </div>
            <UserPlus aria-hidden="true" size={24} />
          </header>
          <div className="voice-draft-summary">
            <strong>{customer.name}</strong>
            <small>{customer.tin ? `TIN ${customer.tin}` : "No TIN yet"}{customer.email ? ` · ${customer.email}` : ""}</small>
          </div>
          {error ? <p className="form-alert" role="alert">{error}</p> : null}
          <div className="voice-draft-actions">
            <button className="button button-secondary" disabled={busy === "customer"} onClick={() => setCustomer(null)} type="button">Discard</button>
            <button className="button button-primary" disabled={busy === "customer" || !customerResolver} onClick={confirmCustomer} type="button">
              {busy === "customer" ? <Loader2 aria-hidden="true" className="spin" size={16} /> : <CheckCircle2 aria-hidden="true" size={16} />}
              Save customer
            </button>
          </div>
        </section>
      ) : null}

      {reminder ? (
        <section className="voice-draft-card" aria-labelledby="voice-reminder-title">
          <header>
            <div>
              <span className="voice-draft-tag">Reminder draft</span>
              <h3 id="voice-reminder-title">For {reminder.customerName}</h3>
            </div>
            <Send aria-hidden="true" size={22} />
          </header>
          <p className="voice-reminder-message">{reminder.message}</p>
          {error ? <p className="form-alert" role="alert">{error}</p> : null}
          <div className="voice-draft-actions">
            <button className="button button-secondary" disabled={busy === "reminder"} onClick={() => setReminder(null)} type="button">
              <Trash2 aria-hidden="true" size={16} />Dismiss
            </button>
            <button className="button button-primary" disabled={busy === "reminder"} onClick={confirmReminder} type="button">
              {busy === "reminder" ? <Loader2 aria-hidden="true" className="spin" size={16} /> : <Send aria-hidden="true" size={16} />}
              Mark as sent
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
