"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, FileText, ShieldCheck } from "lucide-react";
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

export type ReviewField = "type" | "date" | "amount" | "category" | "description" | "counterpartyName" | "paymentMethod";
export type TransactionReviewHints = Partial<Record<ReviewField, string>>;

const typeOptions = [{ label: "Money in", value: "income" }, { label: "Money out", value: "expense" }];
const sourceLabels: Record<TransactionSourceType, string> = {
  receipt: "Receipt photo",
  voice: "Voice note",
  manual: "Manual entry",
  csv: "Spreadsheet row",
  bank_statement: "Bank statement row",
  whatsapp: "WhatsApp message",
};
const fieldLabels: Record<ReviewField, string> = {
  type: "Money in or out",
  date: "Date",
  amount: "Amount",
  category: "Category",
  description: "Description",
  counterpartyName: "Merchant or customer",
  paymentMethod: "Payment method",
};
const confidenceFieldMap: Record<string, ReviewField> = {
  type: "type",
  date: "date",
  amount: "amount",
  total: "amount",
  category: "category",
  description: "description",
  merchant: "counterpartyName",
  counterparty: "counterpartyName",
  paymentMethod: "paymentMethod",
};

function issueExplanation(field: ReviewField, hint?: string) {
  if (hint) return hint;
  if (field === "amount") return "The prepared amount may not match the evidence. An incorrect total changes your financial record.";
  if (field === "date") return "The date was unclear in the evidence. The right date keeps reporting periods accurate.";
  if (field === "counterpartyName") return "The merchant or customer was unclear. Confirming the name makes the record easier to trace later.";
  return `This ${fieldLabels[field].toLowerCase()} was unclear in the evidence. Confirm it before approving the record.`;
}

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
  const issueFields = new Set<ReviewField>(Object.keys(reviewHints ?? {}) as ReviewField[]);
  for (const [field, confidence] of Object.entries(draft.fieldConfidence ?? {})) {
    const mapped = confidenceFieldMap[field];
    if (mapped && confidence < 0.8) issueFields.add(mapped);
  }
  const issues = [...issueFields];
  const focusField = (field: ReviewField) => document.getElementById(field)?.focus();

  return (
    <section className="review-card evidence-review-card" aria-labelledby="transaction-review-title">
      <div className="review-heading">
        <div>
          <p className="section-kicker">Owner review · Step 3 of 3</p>
          <h2 id="transaction-review-title">Compare the evidence with the prepared draft</h2>
          <p>Correct anything that does not match. Nothing is approved until you choose <strong>Approve record</strong>.</p>
        </div>
        <span className="status-badge needs_review"><AlertCircle aria-hidden="true" size={14} />Needs your check</span>
      </div>

      {batchProgress ? <p className="batch-review-progress">Checking {batchProgress.label} {batchProgress.current} of {batchProgress.total}</p> : null}
      {batchNotice ? <div className="form-alert" role="alert"><AlertCircle aria-hidden="true" size={18} /><span>{batchNotice}</span></div> : null}

      <div className="review-trust-strip" aria-label="Review status">
        <span className="trust-label evidence">From your evidence</span>
        <span className="trust-label suggestion">Niaga suggestion</span>
        <span className="trust-label check">Niaga check</span>
        <span className="trust-label myinvois">MyInvois status: Not submitted</span>
      </div>

      <div className="evidence-review-layout">
        <aside className="review-source-pane" aria-labelledby="evidence-used-title">
          <div className="review-pane-heading">
            <span className="trust-label evidence">From your evidence</span>
            <h3 id="evidence-used-title">Evidence used</h3>
            <p>{sourceEvidence?.label || sourceLabels[draft.source]}</p>
          </div>
          <div className="source-document-preview">
            <FileText aria-hidden="true" size={22} />
            {sourceEvidence ? <pre>{sourceEvidence.text}</pre> : <p>{draft.source === "manual" ? "You entered this record directly. There is no separate source document." : "The source is attached to this prepared draft. Compare the visible details before approval."}</p>}
          </div>
          {disclosure ? <div className="evidence-note"><strong>{disclosure.title}</strong><p>{disclosure.description}</p></div> : null}
        </aside>

        <div className="review-draft-pane">
          <div className="review-pane-heading">
            <span className="trust-label suggestion">Niaga suggestion</span>
            <h3>Prepared draft</h3>
            <p>Edit the fields below so they match your evidence.</p>
          </div>

          {issues.length ? (
            <div className="field-check-list" aria-label="Fields that need your check">
              {issues.map((field) => (
                <div className="field-check-item" key={field}>
                  <AlertCircle aria-hidden="true" size={18} />
                  <span><strong>Check {fieldLabels[field].toLowerCase()}</strong><small>{issueExplanation(field, reviewHints?.[field])}</small></span>
                  <button onClick={() => focusField(field)} type="button">Check field</button>
                </div>
              ))}
            </div>
          ) : <div className="niaga-check-note"><ShieldCheck aria-hidden="true" size={18} /><span><strong>Niaga check</strong>No obvious record issue found. Compare it with the evidence before approval.</span></div>}

          <form noValidate onSubmit={handleSubmit(onConfirm)}>
            <input type="hidden" {...register("source")} />
            <input type="hidden" {...register("eInvoiceTreatment")} />
            <div className="review-form-grid">
              <SelectField error={errors.type?.message} hint={reviewHints?.type} label="Money in or out" options={typeOptions} {...register("type")} />
              <FormField error={errors.date?.message} hint={reviewHints?.date} label="Date" type="date" {...register("date")} />
              <FormField className={issueFields.has("amount") ? "field-needs-check" : undefined} error={errors.amount?.message} hint={reviewHints?.amount || "Enter the amount shown in the evidence."} inputMode="decimal" label="Amount (RM)" min="0.01" step="0.01" type="number" {...register("amount", { valueAsNumber: true })} />
              <FormField error={errors.category?.message} hint={reviewHints?.category} label="Category" maxLength={60} placeholder={type === "income" ? "e.g. Sales" : "e.g. Inventory"} {...register("category")} />
              <TextareaField className="review-wide" error={errors.description?.message} hint={reviewHints?.description} label="Description" maxLength={160} rows={3} {...register("description")} />
              <FormField error={errors.counterpartyName?.message} hint={reviewHints?.counterpartyName} label={type === "income" ? "Customer name (optional)" : "Merchant name (optional)"} maxLength={100} {...register("counterpartyName")} />
              <FormField error={errors.paymentMethod?.message} hint={reviewHints?.paymentMethod} label="Payment method (optional)" maxLength={60} placeholder="e.g. Cash or DuitNow QR" {...register("paymentMethod")} />
            </div>

            {saveError ? <div className="form-alert" role="alert"><AlertCircle aria-hidden="true" size={18} /><span>{saveError}</span></div> : null}
            <div className="owner-approval-note"><span>Owner approval</span><strong>Pending your confirmation</strong></div>
            <div className="capture-actions review-actions">
              <button className="button button-secondary" disabled={saving} onClick={onBack} type="button">Change evidence</button>
              {onReject ? <button className="button button-secondary" disabled={saving} onClick={onReject} type="button">Discard draft</button> : null}
              <button className="button button-primary" disabled={isSubmitting || saving} type="submit"><CheckCircle2 aria-hidden="true" size={18} />Approve record</button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
