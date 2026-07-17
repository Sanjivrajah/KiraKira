"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { FormField } from "@/components/forms/form-field";
import { SelectField } from "@/components/forms/select-field";
import { TextareaField } from "@/components/forms/textarea-field";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { MoneyDisplay } from "@/components/shared/money-display";
import { useDeleteTransaction, useTransaction, useUpdateTransaction } from "@/hooks/use-transactions";
import { useBusiness } from "@/hooks/use-business";
import { useAuth } from "@/components/auth/auth-provider";
import { DEMO_BUSINESS } from "@/data/demo";
import { transactionFormSchema } from "@/lib/validation/transaction";
import type { Transaction } from "@/types";
import { sourceLabels, statusLabels } from "./transaction-list";

const editSchema = transactionFormSchema.omit({ source: true }).extend({
  status: z.enum(["draft", "needs_review", "confirmed", "failed"]),
});
type EditInput = z.input<typeof editSchema>;
type EditValues = z.output<typeof editSchema>;
const typeOptions = [{ label: "Income", value: "income" }, { label: "Expense", value: "expense" }];
const statusOptions = Object.entries(statusLabels).map(([value, label]) => ({ value, label }));
const dateFormatter = new Intl.DateTimeFormat("en-MY", { dateStyle: "long" });
const dateTimeFormatter = new Intl.DateTimeFormat("en-MY", { dateStyle: "medium", timeStyle: "short" });

export function TransactionDetail({ id }: { id: string }) {
  const router = useRouter();
  const { mode } = useAuth();
  const businessId = useBusiness().data?.id ?? (mode === "demo" ? DEMO_BUSINESS.id : "");
  const transactionQuery = useTransaction(businessId, id);
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();
  const transaction = transactionQuery.data;
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { control, register, reset, handleSubmit, formState: { errors, isSubmitting } } = useForm<EditInput, unknown, EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: transaction ? {
      type: transaction.type,
      date: transaction.date,
      amount: transaction.total,
      category: transaction.category,
      description: transaction.description,
      counterpartyName: transaction.counterpartyName,
      paymentMethod: transaction.paymentMethod || "",
      status: transaction.status,
    } : undefined,
  });
  const type = useWatch({ control, name: "type" });
  useEffect(() => {
    if (!transaction) return;
    reset({
      type: transaction.type, date: transaction.date, amount: transaction.total, category: transaction.category,
      description: transaction.description, counterpartyName: transaction.counterpartyName,
      paymentMethod: transaction.paymentMethod || "", status: transaction.status,
    });
  }, [reset, transaction]);

  if (transactionQuery.isPending) return <LoadingState label="Loading transaction" />;
  if (transactionQuery.isError) return <><Link className="back-link" href="/transactions"><ArrowLeft aria-hidden="true" size={17} />Back to transactions</Link><ErrorState title="We could not load this transaction" description="Your record is still on this device. Try loading it again." /><button className="button button-secondary" onClick={() => transactionQuery.refetch()} type="button">Try again</button></>;
  if (!transaction) return <><Link className="back-link" href="/transactions"><ArrowLeft aria-hidden="true" size={17} />Back to transactions</Link><ErrorState title="Transaction not found" description="This transaction may have been deleted, or the link is no longer valid." /></>;

  const save = async (values: EditValues) => {
    const updated: Transaction = {
      ...transaction,
      type: values.type,
      date: values.date,
      subtotal: values.amount,
      tax: 0,
      total: values.amount,
      category: values.category,
      description: values.description,
      paymentMethod: values.paymentMethod || null,
      status: values.status,
      counterpartyName: values.counterpartyName,
      updatedAt: new Date().toISOString(),
    };
    setMessage("");
    setError("");
    try {
      await updateTransaction.mutateAsync(updated);
      setEditing(false);
      setError("");
      setMessage("Transaction changes saved.");
    } catch {
      setError("We could not save your changes. Please try again.");
    }
  };

  const remove = async () => {
    setMessage("");
    setError("");
    try {
      await deleteTransaction.mutateAsync({ businessId: transaction.businessId, transactionId: transaction.id });
      router.push("/transactions?deleted=1");
    } catch {
      setConfirmDelete(false);
      setError("We could not void this transaction. Please try again.");
    }
  };

  return (
    <>
      <Link className="back-link" href="/transactions"><ArrowLeft aria-hidden="true" size={17} />Back to transactions</Link>
      <header className="transaction-detail-header"><div><p className="eyebrow">Transaction detail</p><h1>{transaction.description}</h1><p>{dateFormatter.format(new Date(`${transaction.date}T00:00:00`))}</p></div><MoneyDisplay amount={transaction.total} className={transaction.type} prefix={transaction.type === "income" ? "+" : "−"} /></header>

      {message ? <div className="inline-success" role="status"><CheckCircle2 aria-hidden="true" size={18} />{message}<button aria-label="Dismiss message" onClick={() => setMessage("")} type="button">×</button></div> : null}
      {error ? <div className="form-alert" role="alert">{error}</div> : null}

      {editing ? (
        <section className="panel transaction-edit-panel" aria-labelledby="edit-transaction-title"><div className="panel-heading"><div><p className="section-kicker">Edit record</p><h2 id="edit-transaction-title">Transaction fields</h2></div></div>
          <form noValidate onSubmit={handleSubmit(save)}><div className="review-form-grid">
            <SelectField error={errors.type?.message} label="Transaction type" options={typeOptions} {...register("type")} />
            <FormField error={errors.date?.message} label="Date" type="date" {...register("date")} />
            <FormField error={errors.amount?.message} inputMode="decimal" label="Amount (RM)" min="0.01" step="0.01" type="number" {...register("amount", { valueAsNumber: true })} />
            <FormField error={errors.category?.message} label="Category" {...register("category")} />
            <TextareaField className="review-wide" error={errors.description?.message} label="Description" rows={3} {...register("description")} />
            <FormField error={errors.counterpartyName?.message} label={type === "income" ? "Customer name (optional)" : "Merchant name (optional)"} {...register("counterpartyName")} />
            <FormField error={errors.paymentMethod?.message} label="Payment method (optional)" {...register("paymentMethod")} />
            <SelectField error={errors.status?.message} label="Review status" options={statusOptions} {...register("status")} />
          </div><div className="detail-form-actions"><button className="button button-secondary" disabled={updateTransaction.isPending} onClick={() => { setEditing(false); setError(""); reset(); }} type="button">Cancel</button><button className="button button-primary" disabled={isSubmitting || updateTransaction.isPending} type="submit"><CheckCircle2 aria-hidden="true" size={18} />Save changes</button></div></form>
        </section>
      ) : (
        <div className="transaction-detail-grid"><section className="panel structured-fields"><div className="panel-heading"><div><p className="section-kicker">Record details</p><h2>Transaction information</h2></div>{transaction.status === "needs_review" ? <Link className="button button-primary compact-button" href={`/transactions/new?method=${transaction.sourceType}&reviewId=${transaction.id}`}><CheckCircle2 aria-hidden="true" size={16} />Review &amp; approve</Link> : <button className="button button-secondary compact-button" onClick={() => { setEditing(true); setMessage(""); }} type="button"><Pencil aria-hidden="true" size={16} />Edit</button>}</div>
          <dl><div><dt>Type</dt><dd><span className={`type-label ${transaction.type}`}>{transaction.type}</span></dd></div><div><dt>Amount</dt><dd><MoneyDisplay amount={transaction.total} /></dd></div><div><dt>Date</dt><dd>{dateFormatter.format(new Date(`${transaction.date}T00:00:00`))}</dd></div><div><dt>Category</dt><dd>{transaction.category}</dd></div><div className="detail-wide"><dt>Description</dt><dd>{transaction.description}</dd></div><div><dt>{transaction.type === "income" ? "Customer" : "Merchant"}</dt><dd>{transaction.counterpartyName || "Not provided"}</dd></div><div><dt>Payment method</dt><dd>{transaction.paymentMethod || "Not provided"}</dd></div><div><dt>Review status</dt><dd><span className={`status-badge ${transaction.status}`}>{statusLabels[transaction.status]}</span></dd></div></dl>
        </section>
        <aside className="panel transaction-source-panel"><p className="section-kicker">Record history</p><h2>Source information</h2><dl><div><dt>Captured via</dt><dd>{sourceLabels[transaction.sourceType]}</dd></div><div><dt>Created</dt><dd>{dateTimeFormatter.format(new Date(transaction.createdAt))}</dd></div><div><dt>Record ID</dt><dd className="record-id">{transaction.id}</dd></div></dl><button className="button button-danger button-full" onClick={() => setConfirmDelete(true)} type="button"><Trash2 aria-hidden="true" size={17} />Void transaction</button></aside></div>
      )}

      <ConfirmationDialog danger confirmLabel={deleteTransaction.isPending ? "Voiding…" : "Void transaction"} description={`Void “${transaction.description}”? It will remain in the financial history and no longer count as active.`} onCancel={() => setConfirmDelete(false)} onConfirm={remove} open={confirmDelete} pending={deleteTransaction.isPending} title="Void this transaction?" />
    </>
  );
}
