/**
 * Pure mappers turning a staged voice draft into the initial values the app's
 * real forms expect. The voice agent stages a draft (via `create_invoice_draft`
 * / `create_transaction_draft`), then `review_in_form` navigates to the deep
 * route where a thin client wrapper reads the draft store and passes these
 * values in — so the owner reviews and submits the actual form, not a bespoke
 * panel.
 */

import type { TransactionDraft } from "@/components/transactions/transaction-review-form";
import type { VoiceInvoiceDraft, VoiceTransactionDraft } from "./voice-draft-store";

// MyInvois line defaults, mirroring the invoice builder so a voice invoice is
// e-invoice-ready even when the owner didn't dictate explicit codes.
const DEFAULT_CLASSIFICATION_CODE = "022";
const DEFAULT_UNIT_CODE = "C62";
const DEFAULT_TAX_TYPE_CODE = "06";

export interface InvoiceBuilderPrefillItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  classificationCode: string;
  unitCode: string;
  taxTypeCode: string;
  exemptionReason: string;
  discountAmount: number;
  chargeAmount: number;
}

/** Serializable initial values the invoice builder merges into its form defaults. */
export interface InvoiceBuilderPrefill {
  customerId: string | null;
  issueDate: string;
  dueDate: string;
  prepaymentAmount: number;
  paymentTerms: string | null;
  notes: string | null;
  items: InvoiceBuilderPrefillItem[];
}

/** Maps a staged voice invoice into the invoice builder's prefill shape. */
export function voiceInvoiceToPrefill(draft: VoiceInvoiceDraft): InvoiceBuilderPrefill {
  return {
    customerId: draft.customerId,
    issueDate: draft.issueDate,
    dueDate: draft.dueDate,
    prepaymentAmount: draft.prepaymentAmount,
    paymentTerms: draft.paymentTerms,
    notes: draft.notes,
    // Stable, deterministic ids so react-hook-form field keys don't churn.
    items: draft.items.map((item, index) => ({
      id: `voice-item-${index}`,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      classificationCode: item.classificationCode || DEFAULT_CLASSIFICATION_CODE,
      unitCode: item.unitCode || DEFAULT_UNIT_CODE,
      taxTypeCode: item.taxTypeCode || DEFAULT_TAX_TYPE_CODE,
      exemptionReason: item.exemptionReason,
      discountAmount: item.discountAmount,
      chargeAmount: item.chargeAmount,
    })),
  };
}

/** Maps a staged voice transaction into the transaction review form's draft shape. */
export function voiceTransactionToDraft(draft: VoiceTransactionDraft): TransactionDraft {
  return {
    type: draft.type,
    date: draft.date,
    amount: draft.amount ?? undefined,
    category: draft.category,
    description: draft.description,
    counterpartyName: draft.counterpartyName,
    paymentMethod: draft.paymentMethod,
    source: "voice",
    eInvoiceTreatment: "undetermined",
  };
}
