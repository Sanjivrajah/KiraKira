import { create } from "zustand";

/** A staged, unconfirmed transaction the owner must review before it persists. */
export interface VoiceTransactionDraft {
  type: "income" | "expense";
  date: string;
  amount: number | null;
  category: string;
  description: string;
  counterpartyName: string;
  paymentMethod: string;
}

export interface VoiceInvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

/** A staged, unconfirmed invoice the owner must review before it persists. */
export interface VoiceInvoiceDraft {
  customerName: string;
  customerEmail: string | null;
  issueDate: string;
  dueDate: string;
  items: VoiceInvoiceLine[];
  notes: string | null;
}

export interface VoiceReminderDraft {
  customerName: string;
  message: string;
}

export interface VoiceConfirmation {
  kind: "transaction" | "invoice";
  label: string;
}

interface VoiceDraftState {
  transaction: VoiceTransactionDraft | null;
  invoice: VoiceInvoiceDraft | null;
  reminder: VoiceReminderDraft | null;
  lastConfirmation: VoiceConfirmation | null;
  setTransaction: (draft: VoiceTransactionDraft) => void;
  patchTransaction: (patch: Partial<VoiceTransactionDraft>) => void;
  clearTransaction: () => void;
  setInvoice: (draft: VoiceInvoiceDraft) => void;
  clearInvoice: () => void;
  setReminder: (draft: VoiceReminderDraft | null) => void;
  setLastConfirmation: (confirmation: VoiceConfirmation | null) => void;
  reset: () => void;
}

export const useVoiceDraftStore = create<VoiceDraftState>((set) => ({
  transaction: null,
  invoice: null,
  reminder: null,
  lastConfirmation: null,
  setTransaction: (draft) => set({ transaction: draft, lastConfirmation: null }),
  patchTransaction: (patch) =>
    set((state) => (state.transaction ? { transaction: { ...state.transaction, ...patch } } : {})),
  clearTransaction: () => set({ transaction: null }),
  setInvoice: (draft) => set({ invoice: draft, lastConfirmation: null }),
  clearInvoice: () => set({ invoice: null }),
  setReminder: (draft) => set({ reminder: draft }),
  setLastConfirmation: (confirmation) => set({ lastConfirmation: confirmation }),
  reset: () => set({ transaction: null, invoice: null, reminder: null, lastConfirmation: null }),
}));
