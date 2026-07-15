"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, ChevronDown } from "lucide-react";
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
  eInvoiceTreatment?: "individual" | "consolidated_candidate" | "self_billed_candidate" | "not_required" | "undetermined";
  fieldConfidence?: Record<string, number>;
}

export type TransactionReviewHints = Partial<Record<
  "type" | "date" | "amount" | "category" | "description" | "counterpartyName" | "paymentMethod",
  string
>>;

const typeOptions = [{ label: "Money in", value: "income" }, { label: "Money out", value: "expense" }];
const sourceOptions = [
  { label: "Receipt photo", value: "receipt" },
  { label: "Voice note", value: "voice" },
  { label: "Manual entry", value: "manual" },
  { label: "CSV import", value: "csv" },
  { label: "Bank statement", value: "bank_statement" },
  { label: "WhatsApp order", value: "whatsapp" },
];

export function TransactionReviewForm({ draft, onBack, onConfirm, onReject, saveError, saving = false, batchProgress, batchNotice, disclosure, sourceEvidence, reviewHints }: {
  draft: TransactionDraft;
  onBack: () => void;
  onConfirm: (values: ValidTransactionFormValues) => void;
  saveError?: string;
  saving?: boolean;
  batchProgress?: { current: number; total: number; label: string };
  batchNotice?: string;
  disclosure?: { title: string; description: string };
  sourceEvidence?: { label: string; text: string };
  reviewHints?: TransactionReviewHints;
  onReject?: () => void;
}) {
  const { control, register, handleSubmit, formState: { errors, isSubmitting } } = useForm<TransactionFormValues, unknown, ValidTransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: { ...draft, eInvoiceTreatment: draft.eInvoiceTreatment ?? "undetermined" },
  });

  const type = useWatch({ control, name: "type" });

  return (
    <section className="review-card" aria-labelledby="transaction-review-title">
      <div className="review-heading">
        <div>
          <p className="section-kicker">Review · Step 3 of 3</p>
          <h2 id="transaction-review-title">Check the transaction details</h2>
          <p>Check the highlighted details, make any corrections, then approve the record.</p>
        </div>
        <span className="status-badge needs_review"><AlertCircle aria-hidden="true" size={14} />Needs review</span>
      </div>

      {batchProgress ? <p className="batch-review-progress">Reviewing {batchProgress.label} {batchProgress.current} of {batchProgress.total}</p> : null}
      {batchNotice ? <div className="form-alert" role="alert"><AlertCircle aria-hidden="true" size={18} /><span>{batchNotice}</span></div> : null}

      {disclosure || sourceEvidence ? (
        <details className="review-evidence">
          <summary>Original source and processing details <ChevronDown aria-hidden="true" size={17} /></summary>
          {disclosure ? <p><strong>{disclosure.title}</strong> {disclosure.description}</p> : null}
          {sourceEvidence ? <blockquote><span>{sourceEvidence.label}</span>“{sourceEvidence.text}”</blockquote> : null}
        </details>
      ) : null}
      {draft.fieldConfidence && Object.keys(draft.fieldConfidence).length ? <div className="confidence-grid" aria-label="Extraction confidence by field">{Object.entries(draft.fieldConfidence).map(([field, confidence]) => <span className={confidence < 0.8 ? "low-confidence" : ""} key={field}><strong>{field}</strong>{Math.round(confidence * 100)}%{confidence < 0.8 ? " · Check carefully" : ""}</span>)}</div> : null}

      <form noValidate onSubmit={handleSubmit(onConfirm)}>
        <div className="review-form-grid">
          <SelectField error={errors.type?.message} hint={reviewHints?.type} label="Transaction type" options={typeOptions} {...register("type")} />
          <FormField error={errors.date?.message} hint={reviewHints?.date} label="Date" type="date" {...register("date")} />
          <FormField error={errors.amount?.message} hint={reviewHints?.amount || "Enter the value in Malaysian ringgit."} inputMode="decimal" label="Amount (RM)" min="0.01" step="0.01" type="number" {...register("amount", { valueAsNumber: true })} />
          <FormField error={errors.category?.message} hint={reviewHints?.category} label="Category" maxLength={60} placeholder={type === "income" ? "e.g. Sales" : "e.g. Inventory"} {...register("category")} />
          <TextareaField className="review-wide" error={errors.description?.message} hint={reviewHints?.description} label="Description" maxLength={160} rows={3} {...register("description")} />
          <FormField error={errors.counterpartyName?.message} hint={reviewHints?.counterpartyName} label={type === "income" ? "Customer name (optional)" : "Merchant name (optional)"} maxLength={100} {...register("counterpartyName")} />
          <FormField error={errors.paymentMethod?.message} hint={reviewHints?.paymentMethod} label="Payment method (optional)" maxLength={60} placeholder="e.g. Cash or DuitNow QR" {...register("paymentMethod")} />
          <SelectField error={errors.source?.message} hint="You can correct the source if needed." label="Source" options={sourceOptions} {...register("source")} />
          <SelectField error={errors.eInvoiceTreatment?.message} label="E-Invoice treatment" options={[
            { value: "undetermined", label: "Undetermined" },
            { value: "individual", label: "Individual e-Invoice" },
            { value: "consolidated_candidate", label: "Consolidated candidate" },
            { value: "self_billed_candidate", label: "Self-billed candidate" },
            { value: "not_required", label: "Not required" },
          ]} {...register("eInvoiceTreatment")} />
          <div className="review-status-field">
            <span>Review status</span>
            <strong><CheckCircle2 aria-hidden="true" size={17} />Reviewed when confirmed</strong>
          </div>
        </div>

        {saveError ? <div className="form-alert" role="alert"><AlertCircle aria-hidden="true" size={18} /><span>{saveError}</span></div> : null}
        <div className="capture-actions review-actions">
          <button className="button button-secondary" disabled={saving} onClick={onBack} type="button">Edit source</button>
          {onReject ? <button className="button button-secondary" disabled={saving} onClick={onReject} type="button">Reject draft</button> : null}
          <button aria-label="Confirm and save — approve transaction" className="button button-primary" disabled={isSubmitting || saving} type="submit"><CheckCircle2 aria-hidden="true" size={18} />Approve and save</button>
        </div>
      </form>
    </section>
  );
}
