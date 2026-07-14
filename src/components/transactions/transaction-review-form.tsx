"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { FormField } from "@/components/forms/form-field";
import { SelectField } from "@/components/forms/select-field";
import { TextareaField } from "@/components/forms/textarea-field";
import { transactionFormSchema, type TransactionFormValues, type ValidTransactionFormValues } from "@/lib/validation/transaction";
import type { TransactionSourceType } from "@/types";

export interface TransactionDraft {
  type: "income" | "expense";
  date: string;
  amount: number | undefined;
  category: string;
  description: string;
  counterpartyName: string;
  paymentMethod: string;
  source: TransactionSourceType;
}

const typeOptions = [{ label: "Money in", value: "income" }, { label: "Money out", value: "expense" }];
const sourceOptions = [
  { label: "Receipt photo", value: "receipt" },
  { label: "Voice note", value: "voice" },
  { label: "Manual entry", value: "manual" },
  { label: "CSV import", value: "csv" },
  { label: "Bank statement", value: "bank_statement" },
  { label: "WhatsApp order", value: "whatsapp" },
];

export function TransactionReviewForm({ draft, onBack, onConfirm, saveError, saving = false, batchProgress, batchNotice, disclosure, sourceEvidence }: {
  draft: TransactionDraft;
  onBack: () => void;
  onConfirm: (values: ValidTransactionFormValues) => void;
  saveError?: string;
  saving?: boolean;
  batchProgress?: { current: number; total: number; label: string };
  batchNotice?: string;
  disclosure?: { title: string; description: string };
  sourceEvidence?: { label: string; text: string };
}) {
  const { control, register, handleSubmit, formState: { errors, isSubmitting } } = useForm<TransactionFormValues, unknown, ValidTransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: draft,
  });

  const type = useWatch({ control, name: "type" });

  return (
    <section className="review-card" aria-labelledby="transaction-review-title">
      <div className="review-heading">
        <div>
          <p className="section-kicker">Review · Step 3 of 3</p>
          <h2 id="transaction-review-title">Check the transaction details</h2>
          <p>Generated values start as needing review. Edit anything below, then confirm to mark the record reviewed.</p>
        </div>
        <span className="status-badge needs_review"><AlertCircle aria-hidden="true" size={14} />Needs review</span>
      </div>

      {batchProgress ? <p className="batch-review-progress">Reviewing {batchProgress.label} {batchProgress.current} of {batchProgress.total}</p> : null}
      {batchNotice ? <div className="form-alert" role="alert"><AlertCircle aria-hidden="true" size={18} /><span>{batchNotice}</span></div> : null}

      <div className="demo-disclosure"><ShieldCheck aria-hidden="true" size={18} /><p><strong>{disclosure?.title || (draft.source === "receipt" ? "AI-proposed extraction" : "Owner-entered transaction")}</strong><span>{disclosure?.description || (draft.source === "receipt" ? "OpenAI processed the image. Check every value before confirming." : "Check every value before confirming this transaction.")}</span></p></div>
      {sourceEvidence ? <div className="transcript-preview"><span>{sourceEvidence.label}</span><p>“{sourceEvidence.text}”</p></div> : null}

      <form noValidate onSubmit={handleSubmit(onConfirm)}>
        <div className="review-form-grid">
          <SelectField error={errors.type?.message} label="Transaction type" options={typeOptions} {...register("type")} />
          <FormField error={errors.date?.message} label="Date" type="date" {...register("date")} />
          <FormField error={errors.amount?.message} hint="Enter the value in Malaysian ringgit." inputMode="decimal" label="Amount (RM)" min="0.01" step="0.01" type="number" {...register("amount", { valueAsNumber: true })} />
          <FormField error={errors.category?.message} label="Category" maxLength={60} placeholder={type === "income" ? "e.g. Sales" : "e.g. Inventory"} {...register("category")} />
          <TextareaField className="review-wide" error={errors.description?.message} label="Description" maxLength={160} rows={3} {...register("description")} />
          <FormField error={errors.counterpartyName?.message} label={type === "income" ? "Customer name (optional)" : "Merchant name (optional)"} maxLength={100} {...register("counterpartyName")} />
          <FormField error={errors.paymentMethod?.message} label="Payment method (optional)" maxLength={60} placeholder="e.g. Cash or DuitNow QR" {...register("paymentMethod")} />
          <SelectField error={errors.source?.message} hint="You can correct the source if needed." label="Source" options={sourceOptions} {...register("source")} />
          <div className="review-status-field">
            <span>Review status</span>
            <strong><CheckCircle2 aria-hidden="true" size={17} />Reviewed when confirmed</strong>
          </div>
        </div>

        {saveError ? <div className="form-alert" role="alert"><AlertCircle aria-hidden="true" size={18} /><span>{saveError}</span></div> : null}
        <div className="capture-actions review-actions">
          <button className="button button-secondary" disabled={saving} onClick={onBack} type="button">Back to methods</button>
          <button className="button button-primary" disabled={isSubmitting || saving} type="submit"><CheckCircle2 aria-hidden="true" size={18} />Confirm and save</button>
        </div>
      </form>
    </section>
  );
}
