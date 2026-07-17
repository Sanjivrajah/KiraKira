import { create } from "zustand";
import type { Transaction } from "@/types";

/** Whether a staged transaction will create a new record or update an existing one. */
export type VoiceDraftMode = "create" | "edit";

/** A staged, unconfirmed transaction the owner must review before it persists. */
export interface VoiceTransactionDraft {
  mode: VoiceDraftMode;
  /** Set when editing a saved record so confirm calls `update` instead of `create`. */
  editingId: string | null;
  type: "income" | "expense";
  date: string;
  /** The spoken amount, interpreted per `taxInclusive` when computing the tax split. */
  amount: number | null;
  /** SST/tax percentage (e.g. 6 for 6% SST). 0 means no tax. */
  taxRate: number;
  /** Whether `amount` already includes tax (RM106 incl. 6%) or excludes it (RM100 + 6%). */
  taxInclusive: boolean;
  quantity: number | null;
  unit: string;
  category: string;
  description: string;
  counterpartyId: string | null;
  counterpartyName: string;
  /** Normalized `paymentMethodSchema` value, or "" when not yet known. */
  paymentMethod: string;
  notes: string;
  /** The source record preserved verbatim when editing, so unrelated fields survive. */
  original: Transaction | null;
}

export interface VoiceInvoiceLine {
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

/** A staged, unconfirmed invoice the owner must review before it persists. */
export interface VoiceInvoiceDraft {
  customerId: string | null;
  customerName: string;
  customerEmail: string | null;
  buyerTin: string | null;
  issueDate: string;
  dueDate: string;
  paymentTerms: string | null;
  prepaymentAmount: number;
  items: VoiceInvoiceLine[];
  notes: string | null;
}

/** A staged payment reminder linked to the outstanding invoice it will be sent against. */
export interface VoiceReminderDraft {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string | null;
  message: string;
}

/** A staged, destructive delete awaiting explicit confirmation. */
export interface VoicePendingDelete {
  kind: "transaction";
  id: string;
  label: string;
}

/** A staged invoice payment awaiting explicit confirmation. */
export interface VoicePendingPayment {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  amount: number;
  currentPaid: number;
  total: number;
}

/** A staged new customer awaiting explicit confirmation. */
export interface VoiceCustomerDraft {
  name: string;
  email: string | null;
  phone: string | null;
  tin: string | null;
  registrationNumber: string | null;
  address: string | null;
}

export interface VoiceConfirmation {
  kind:
    | "transaction"
    | "invoice"
    | "reminder"
    | "payment"
    | "customer"
    | "delete";
  label: string;
}

interface VoiceDraftState {
  transaction: VoiceTransactionDraft | null;
  invoice: VoiceInvoiceDraft | null;
  reminder: VoiceReminderDraft | null;
  pendingDelete: VoicePendingDelete | null;
  pendingPayment: VoicePendingPayment | null;
  customer: VoiceCustomerDraft | null;
  lastConfirmation: VoiceConfirmation | null;
  setTransaction: (draft: VoiceTransactionDraft) => void;
  patchTransaction: (patch: Partial<VoiceTransactionDraft>) => void;
  clearTransaction: () => void;
  setInvoice: (draft: VoiceInvoiceDraft) => void;
  patchInvoice: (patch: Partial<VoiceInvoiceDraft>) => void;
  clearInvoice: () => void;
  setReminder: (draft: VoiceReminderDraft | null) => void;
  setPendingDelete: (draft: VoicePendingDelete | null) => void;
  setPendingPayment: (draft: VoicePendingPayment | null) => void;
  setCustomer: (draft: VoiceCustomerDraft | null) => void;
  setLastConfirmation: (confirmation: VoiceConfirmation | null) => void;
  reset: () => void;
}

export const useVoiceDraftStore = create<VoiceDraftState>((set) => ({
  transaction: null,
  invoice: null,
  reminder: null,
  pendingDelete: null,
  pendingPayment: null,
  customer: null,
  lastConfirmation: null,
  setTransaction: (draft) =>
    set({ transaction: draft, lastConfirmation: null }),
  patchTransaction: (patch) =>
    set((state) =>
      state.transaction
        ? { transaction: { ...state.transaction, ...patch } }
        : {},
    ),
  clearTransaction: () => set({ transaction: null }),
  setInvoice: (draft) => set({ invoice: draft, lastConfirmation: null }),
  patchInvoice: (patch) =>
    set((state) =>
      state.invoice ? { invoice: { ...state.invoice, ...patch } } : {},
    ),
  clearInvoice: () => set({ invoice: null }),
  setReminder: (draft) => set({ reminder: draft }),
  setPendingDelete: (draft) => set({ pendingDelete: draft }),
  setPendingPayment: (draft) => set({ pendingPayment: draft }),
  setCustomer: (draft) => set({ customer: draft }),
  setLastConfirmation: (confirmation) =>
    set({ lastConfirmation: confirmation }),
  reset: () =>
    set({
      transaction: null,
      invoice: null,
      reminder: null,
      pendingDelete: null,
      pendingPayment: null,
      customer: null,
      lastConfirmation: null,
    }),
}));
