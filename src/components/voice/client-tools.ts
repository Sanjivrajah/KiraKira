import { z } from "zod";
import { makeEntityId } from "@/services/id";
import { formatMoney } from "@/lib/format/money";
import { calculateInvoiceTotals } from "@/lib/invoices/calculations";
import type { Invoice, Transaction } from "@/types";
import {
  computeTransactionTotals,
  kualaLumpurToday,
  normalizePaymentMethod,
  outstandingBalances,
  resolveFinancePeriod,
  searchTransactions,
  summarizeTransactions,
  type FinancePeriodKey,
  type OutstandingBalance,
} from "./voice-finance";
import { matchCustomers } from "./voice-customers";
import type {
  VoiceConfirmation,
  VoiceCustomerDraft,
  VoiceInvoiceDraft,
  VoiceInvoiceLine,
  VoicePendingDelete,
  VoicePendingPayment,
  VoiceReminderDraft,
  VoiceTransactionDraft,
} from "./voice-draft-store";
import type { VoiceCustomer, VoiceCustomerInput } from "./voice-customers";

type NewTransaction = Omit<Transaction, "id" | "createdAt" | "updatedAt">;
type NewInvoice = Omit<Invoice, "id" | "createdAt" | "updatedAt" | "subtotal" | "tax" | "total">;

/** E-invoice readiness snapshot the agent reads back; built from the active business. */
export interface VoiceBusinessContext {
  businessName: string;
  hasTin: boolean;
  hasSstRegistration: boolean;
  hasMsicCode: boolean;
  hasAddress: boolean;
  hasRegistrationNumber: boolean;
}

/** Client-side draft controller the tools mutate; backed by the Zustand store at runtime. */
export interface VoiceDraftController {
  setTransaction(draft: VoiceTransactionDraft): void;
  patchTransaction(patch: Partial<VoiceTransactionDraft>): void;
  getTransaction(): VoiceTransactionDraft | null;
  clearTransaction(): void;
  setInvoice(draft: VoiceInvoiceDraft): void;
  patchInvoice(patch: Partial<VoiceInvoiceDraft>): void;
  getInvoice(): VoiceInvoiceDraft | null;
  clearInvoice(): void;
  setReminder(draft: VoiceReminderDraft | null): void;
  getReminder(): VoiceReminderDraft | null;
  setPendingDelete(draft: VoicePendingDelete | null): void;
  getPendingDelete(): VoicePendingDelete | null;
  setPendingPayment(draft: VoicePendingPayment | null): void;
  getPendingPayment(): VoicePendingPayment | null;
  setCustomer(draft: VoiceCustomerDraft | null): void;
  getCustomer(): VoiceCustomerDraft | null;
  setLastConfirmation(confirmation: VoiceConfirmation | null): void;
}

export interface VoiceClientToolDeps {
  businessId: string;
  createdBy: string;
  draft: VoiceDraftController;
  listTransactions(): Promise<Transaction[]>;
  createTransaction(input: NewTransaction): Promise<Transaction>;
  listInvoices(): Promise<Invoice[]>;
  nextInvoiceNumber(): Promise<string>;
  createInvoice(input: NewInvoice): Promise<Invoice>;
  navigate(href: string): void;
  getContext(): { pathname: string; businessName: string };
  now?: () => Date;
  /** Optional deps power the "manage saved records" tools; wired in `use-voice-agent`. */
  updateTransaction?(transaction: Transaction): Promise<Transaction>;
  removeTransaction?(transactionId: string): Promise<void>;
  updateInvoice?(invoice: Invoice): Promise<Invoice>;
  markReminderSent?(invoice: Invoice, messagePreview: string): Promise<void>;
  listCustomers?(): Promise<VoiceCustomer[]>;
  createCustomer?(input: VoiceCustomerInput): Promise<VoiceCustomer>;
  getBusinessContext?(): VoiceBusinessContext | null;
}

/** ElevenLabs delivers tool parameters as untrusted JSON, so every tool validates first. */
type ClientTool = (parameters: Record<string, unknown>) => Promise<string> | string;

const periodKeys: FinancePeriodKey[] = [
  "today",
  "yesterday",
  "this_week",
  "this_month",
  "last_month",
  "this_year",
  "all",
];

// ElevenLabs may send booleans as strings ("true"/"yes"); interpret them leniently.
const booleanish = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return /^(true|yes|1|inclusive|incl|including|inc)$/i.test(value.trim());
  return value;
}, z.boolean());

const transactionDraftSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.coerce.number().positive().max(10_000_000).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  category: z.string().trim().max(60).optional(),
  description: z.string().trim().max(160).optional(),
  counterpartyName: z.string().trim().max(100).optional(),
  paymentMethod: z.string().trim().max(60).optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  taxInclusive: booleanish.optional(),
  quantity: z.coerce.number().positive().max(1_000_000).optional(),
  unit: z.string().trim().max(30).optional(),
  notes: z.string().trim().max(500).optional(),
});

// MyInvois line defaults, matching the manual invoice builder so voice invoices
// are e-invoice-ready. Overridable when the agent supplies explicit codes.
const DEFAULT_CLASSIFICATION_CODE = "022";
const DEFAULT_UNIT_CODE = "C62";
const DEFAULT_TAX_TYPE_CODE = "06";
const DEFAULT_PAYMENT_TERMS = "Payment due within 14 days.";

const invoiceLineSchema = z.object({
  description: z.string().trim().min(1).max(200),
  quantity: z.coerce.number().positive().max(100_000),
  unitPrice: z.coerce.number().nonnegative().max(10_000_000),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  classificationCode: z.string().trim().max(20).optional(),
  unitCode: z.string().trim().max(20).optional(),
  taxTypeCode: z.string().trim().max(10).optional(),
  exemptionReason: z.string().trim().max(300).optional(),
  discountAmount: z.coerce.number().min(0).max(10_000_000).optional(),
  chargeAmount: z.coerce.number().min(0).max(10_000_000).optional(),
});

function toVoiceInvoiceLine(item: z.infer<typeof invoiceLineSchema>): VoiceInvoiceLine {
  return {
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    taxRate: item.taxRate ?? 0,
    classificationCode: item.classificationCode ?? DEFAULT_CLASSIFICATION_CODE,
    unitCode: item.unitCode ?? DEFAULT_UNIT_CODE,
    taxTypeCode: item.taxTypeCode ?? DEFAULT_TAX_TYPE_CODE,
    exemptionReason: item.exemptionReason ?? "",
    discountAmount: item.discountAmount ?? 0,
    chargeAmount: item.chargeAmount ?? 0,
  };
}

// ElevenLabs client tools cannot reliably describe an array-of-objects parameter,
// so the agent sends `items` as a JSON string. Accept either that string or a real
// array (tests, or a future richer schema) and validate to the same shape.
const invoiceItemsSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return value; }
  }
  return value;
}, z.array(invoiceLineSchema).min(1).max(50));

const invoiceDraftSchema = z.object({
  customerName: z.string().trim().min(1).max(200),
  customerEmail: z.string().trim().max(160).optional(),
  buyerTin: z.string().trim().max(50).optional(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  paymentTerms: z.string().trim().max(500).optional(),
  prepaymentAmount: z.coerce.number().min(0).max(10_000_000).optional(),
  items: invoiceItemsSchema,
  notes: z.string().trim().max(500).optional(),
});

const invoicePatchSchema = z.object({
  customerName: z.string().trim().min(1).max(200).optional(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  paymentTerms: z.string().trim().max(500).optional(),
  prepaymentAmount: z.coerce.number().min(0).max(10_000_000).optional(),
  notes: z.string().trim().max(500).optional(),
});

const financeMetrics = ["summary", "profit", "income", "expenses", "biggest_expense", "cash_in", "cash_out"] as const;
const financeQuerySchema = z.object({
  period: z.enum(periodKeys as [FinancePeriodKey, ...FinancePeriodKey[]]).optional(),
  metric: z.enum(financeMetrics).optional(),
});

const reminderSchema = z.object({
  customerName: z.string().trim().max(100).optional(),
  invoiceNumber: z.string().trim().max(60).optional(),
});

const paymentSchema = z.object({
  customerName: z.string().trim().max(100).optional(),
  invoiceNumber: z.string().trim().max(60).optional(),
  amount: z.coerce.number().positive().max(10_000_000).optional(),
});

const customerDraftSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().max(160).refine((value) => !value || /.+@.+\..+/.test(value), "Enter a valid email.").optional(),
  tin: z.string().trim().max(50).optional(),
  registrationNumber: z.string().trim().max(50).optional(),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(300).optional(),
});

const findTransactionsSchema = z.object({
  query: z.string().trim().max(120).optional(),
  type: z.enum(["income", "expense"]).optional(),
  limit: z.coerce.number().int().min(1).max(10).optional(),
});

const targetTransactionSchema = z.object({
  transactionId: z.string().trim().min(1).max(120).optional(),
  query: z.string().trim().max(120).optional(),
});

const navigateSchema = z.object({
  destination: z.string().trim().min(1).max(40),
});

const NAV_DESTINATIONS: Record<string, string> = {
  dashboard: "/dashboard",
  home: "/dashboard",
  records: "/transactions",
  transactions: "/transactions",
  invoices: "/invoices",
  "e-invoice": "/invoices",
  einvoice: "/invoices",
  reminders: "/reminders",
  settings: "/settings",
  business: "/settings",
  voice: "/voice",
};

const rm = (amount: number) => formatMoney(amount, { currency: "MYR" });

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "cash",
  bank_transfer: "bank transfer",
  card: "card",
  ewallet: "e-wallet",
  credit: "credit",
};

/** Friendly spoken label for a stored payment-method enum; empty when not worth saying. */
function spokenPaymentMethod(method: string): string {
  return PAYMENT_METHOD_LABELS[method] ?? "";
}

/** Adds calendar days to an ISO date (UTC-safe), used for default invoice due dates. */
function addIsoDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** A short, spoken-friendly label for a saved transaction. */
function transactionLabel(transaction: Transaction): string {
  const flow = transaction.type === "income" ? "money in" : "money out";
  const detail = transaction.description || transaction.category || "transaction";
  return `${rm(transaction.total)} ${flow} for ${detail} on ${transaction.date}`;
}

type TransactionResolution =
  | { kind: "one"; match: Transaction }
  | { kind: "many"; matches: Transaction[] }
  | { kind: "none" };

/** Resolves an edit/delete target: an explicit id wins, else a fuzzy query. */
function resolveTransaction(
  transactions: readonly Transaction[],
  target: { transactionId?: string; query?: string },
): TransactionResolution {
  if (target.transactionId) {
    const match = transactions.find((transaction) => transaction.id === target.transactionId);
    return match ? { kind: "one", match } : { kind: "none" };
  }
  if (target.query) {
    const matches = searchTransactions(transactions, target.query, 4);
    if (matches.length === 1) return { kind: "one", match: matches[0] };
    if (matches.length > 1) return { kind: "many", matches };
  }
  return { kind: "none" };
}

/** Finds an outstanding balance by exact invoice number or a customer-name match. */
function findBalance(
  balances: readonly OutstandingBalance[],
  target: { customerName?: string; invoiceNumber?: string },
): OutstandingBalance | undefined {
  return balances.find((balance) => {
    if (target.invoiceNumber && balance.invoiceNumber.toLowerCase() === target.invoiceNumber.toLowerCase()) return true;
    if (target.customerName) return balance.customerName.toLowerCase().includes(target.customerName.toLowerCase());
    return false;
  });
}

function transactionMissingFields(draft: VoiceTransactionDraft): string[] {
  const missing: string[] = [];
  if (draft.amount === null || draft.amount === undefined) missing.push("amount");
  if (!draft.description.trim()) missing.push("description");
  if (!draft.category.trim()) missing.push("category");
  return missing;
}

function describeTransaction(draft: VoiceTransactionDraft): string {
  const amount = draft.amount != null ? rm(draft.amount) : "an unspecified amount";
  const flow = draft.type === "income" ? "money in" : "money out";
  const who = draft.counterpartyName ? ` with ${draft.counterpartyName}` : "";
  const how = spokenPaymentMethod(draft.paymentMethod) ? ` paid by ${spokenPaymentMethod(draft.paymentMethod)}` : "";
  const tax = draft.amount != null && draft.taxRate > 0
    ? ` (${draft.taxRate}% SST ${draft.taxInclusive ? "included" : "on top"})`
    : "";
  return `${flow} of ${amount}${tax} for ${draft.description || draft.category || "a transaction"}${who}${how} on ${draft.date}`;
}

/**
 * Builds the ElevenLabs client-tool map. Pure aside from the injected deps, so it
 * can be unit-tested with fakes. Write tools stage drafts; confirm tools persist.
 * Every tool returns a short spoken-friendly string the agent reads back.
 */
export function createVoiceClientTools(deps: VoiceClientToolDeps): Record<string, ClientTool> {
  const today = () => kualaLumpurToday(deps.now?.() ?? new Date());

  return {
    create_transaction_draft: (parameters) => {
      const parsed = transactionDraftSchema.safeParse(parameters);
      if (!parsed.success) return "I couldn't read those transaction details. Please tell me the amount and whether it was money in or out.";
      const draft: VoiceTransactionDraft = {
        mode: "create",
        editingId: null,
        type: parsed.data.type,
        amount: parsed.data.amount ?? null,
        taxRate: parsed.data.taxRate ?? 0,
        taxInclusive: parsed.data.taxInclusive ?? false,
        quantity: parsed.data.quantity ?? null,
        unit: parsed.data.unit ?? "",
        date: parsed.data.date ?? today(),
        category: parsed.data.category ?? "",
        description: parsed.data.description ?? "",
        counterpartyId: null,
        counterpartyName: parsed.data.counterpartyName ?? "",
        paymentMethod: parsed.data.paymentMethod ? normalizePaymentMethod(parsed.data.paymentMethod) : "",
        notes: parsed.data.notes ?? "",
        original: null,
      };
      deps.draft.setTransaction(draft);
      const missing = transactionMissingFields(draft);
      const summary = `I've staged ${describeTransaction(draft)}.`;
      if (missing.length > 0) return `${summary} I still need the ${missing.join(" and ")} before we can save it.`;
      return `${summary} Say "save it" to confirm, or tell me what to change.`;
    },

    update_transaction_draft: (parameters) => {
      if (!deps.draft.getTransaction()) return "There's no transaction staged yet. Tell me a sale or an expense first.";
      const parsed = transactionDraftSchema.partial().safeParse(parameters);
      if (!parsed.success) return "I couldn't read that correction. Please repeat the field and its value.";
      const patch: Partial<VoiceTransactionDraft> = {};
      if (parsed.data.type) patch.type = parsed.data.type;
      if (parsed.data.amount !== undefined) patch.amount = parsed.data.amount;
      if (parsed.data.taxRate !== undefined) patch.taxRate = parsed.data.taxRate;
      if (parsed.data.taxInclusive !== undefined) patch.taxInclusive = parsed.data.taxInclusive;
      if (parsed.data.quantity !== undefined) patch.quantity = parsed.data.quantity;
      if (parsed.data.unit !== undefined) patch.unit = parsed.data.unit;
      if (parsed.data.date) patch.date = parsed.data.date;
      if (parsed.data.category !== undefined) patch.category = parsed.data.category;
      if (parsed.data.description !== undefined) patch.description = parsed.data.description;
      if (parsed.data.counterpartyName !== undefined) patch.counterpartyName = parsed.data.counterpartyName;
      if (parsed.data.paymentMethod !== undefined) patch.paymentMethod = normalizePaymentMethod(parsed.data.paymentMethod);
      if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes;
      deps.draft.patchTransaction(patch);
      const updated = deps.draft.getTransaction();
      return updated ? `Updated. It now reads: ${describeTransaction(updated)}.` : "Updated the transaction.";
    },

    confirm_transaction: async () => {
      const draft = deps.draft.getTransaction();
      if (!draft) return "There's nothing staged to confirm yet.";
      if (draft.amount === null || draft.amount === undefined) return "I need the amount before I can save this. How much was it?";
      const missing = transactionMissingFields(draft).filter((field) => field !== "amount");
      if (missing.length > 0) return `Before saving, I still need the ${missing.join(" and ")}.`;
      const totals = computeTransactionTotals(draft.amount, draft.taxRate, draft.taxInclusive);
      try {
        if (draft.mode === "edit" && draft.editingId && draft.original) {
          if (!deps.updateTransaction) return "Editing saved records isn't available right now.";
          const updated = await deps.updateTransaction({
            ...draft.original,
            type: draft.type,
            subtotal: totals.subtotal,
            tax: totals.tax,
            total: totals.total,
            currency: "MYR",
            date: draft.date,
            category: draft.category,
            description: draft.description,
            counterpartyId: draft.counterpartyId,
            counterpartyName: draft.counterpartyName,
            paymentMethod: draft.paymentMethod || null,
            notes: draft.notes || null,
            items: [],
          });
          deps.draft.clearTransaction();
          deps.draft.setLastConfirmation({ kind: "transaction", label: `${rm(updated.total)} ${updated.type === "income" ? "money in" : "money out"} (updated)` });
          return `Updated the record. It now reads ${rm(updated.total)} as ${updated.type === "income" ? "money in" : "money out"}.`;
        }
        const created = await deps.createTransaction({
          businessId: deps.businessId,
          createdBy: deps.createdBy,
          type: draft.type,
          subtotal: totals.subtotal,
          tax: totals.tax,
          total: totals.total,
          currency: "MYR",
          date: draft.date,
          category: draft.category,
          description: draft.description,
          counterpartyId: draft.counterpartyId,
          counterpartyName: draft.counterpartyName,
          paymentMethod: draft.paymentMethod || null,
          notes: draft.notes || null,
          sourceType: "voice",
          status: "confirmed",
          items: [],
        });
        deps.draft.clearTransaction();
        deps.draft.setLastConfirmation({ kind: "transaction", label: `${rm(created.total)} ${created.type === "income" ? "money in" : "money out"}` });
        return `Saved ${rm(created.total)} as ${created.type === "income" ? "money in" : "money out"}. It's now in your records.`;
      } catch {
        return "I couldn't save that just now. Please try again in a moment.";
      }
    },

    discard_draft: (parameters) => {
      const kind = typeof parameters?.kind === "string" ? parameters.kind : "all";
      if (kind === "invoice") {
        deps.draft.clearInvoice();
        return "Discarded the invoice draft.";
      }
      if (kind === "transaction") {
        deps.draft.clearTransaction();
        return "Discarded the transaction draft.";
      }
      deps.draft.clearTransaction();
      deps.draft.clearInvoice();
      return "Discarded the current draft.";
    },

    query_finances: async (parameters) => {
      const parsed = financeQuerySchema.safeParse(parameters ?? {});
      const key = parsed.success ? parsed.data.period ?? "this_month" : "this_month";
      const metric = parsed.success ? parsed.data.metric ?? "summary" : "summary";
      const period = resolveFinancePeriod(key, deps.now?.() ?? new Date());
      const summary = summarizeTransactions(await deps.listTransactions(), period);
      if (summary.transactionCount === 0) return `You have no confirmed records for ${period.label}.`;
      const top = summary.topExpenseCategories[0];
      switch (metric) {
        case "profit":
          return `Your estimated profit for ${period.label} is ${rm(summary.estimatedProfit)} (money in ${rm(summary.income)} minus money out ${rm(summary.expenses)}).`;
        case "income":
        case "cash_in":
          return `Money in for ${period.label} is ${rm(summary.income)} across ${summary.transactionCount} record${summary.transactionCount === 1 ? "" : "s"}.`;
        case "expenses":
        case "cash_out":
          return `Money out for ${period.label} is ${rm(summary.expenses)}.${top ? ` Your biggest expense category is ${top[0]} at ${rm(top[1])}.` : ""}`;
        case "biggest_expense":
          return top ? `Your biggest expense for ${period.label} is ${top[0]} at ${rm(top[1])}.` : `You have no expenses recorded for ${period.label}.`;
        default: {
          const topText = top ? ` Your biggest expense was ${top[0]} at ${rm(top[1])}.` : "";
          return `For ${period.label}: money in ${rm(summary.income)}, money out ${rm(summary.expenses)}, estimated profit ${rm(summary.estimatedProfit)}, across ${summary.transactionCount} record${summary.transactionCount === 1 ? "" : "s"}.${topText}`;
        }
      }
    },

    get_business_snapshot: async () => {
      const period = resolveFinancePeriod("this_month", deps.now?.() ?? new Date());
      const [transactions, invoices] = await Promise.all([deps.listTransactions(), deps.listInvoices()]);
      const summary = summarizeTransactions(transactions, period);
      const balances = outstandingBalances(invoices, today());
      const outstanding = balances.reduce((sum, balance) => sum + balance.outstanding, 0);
      const overdue = balances.filter((balance) => balance.overdue).length;
      const staged = [deps.draft.getTransaction(), deps.draft.getInvoice(), deps.draft.getPendingPayment(), deps.draft.getCustomer()].filter(Boolean).length;
      const receivablesText = balances.length > 0
        ? `${balances.length} unpaid invoice${balances.length === 1 ? "" : "s"} totalling ${rm(outstanding)}${overdue ? `, ${overdue} overdue` : ""}.`
        : "No unpaid invoices.";
      const stagedText = staged > 0 ? ` ${staged} item${staged === 1 ? "" : "s"} waiting in your review queue.` : "";
      return `This month: money in ${rm(summary.income)}, money out ${rm(summary.expenses)}, estimated profit ${rm(summary.estimatedProfit)}. ${receivablesText}${stagedText}`;
    },

    get_business_context: () => {
      const context = deps.getBusinessContext?.() ?? null;
      if (!context) return "I couldn't read your business details right now. Open your business settings to review them.";
      const gaps: string[] = [];
      if (!context.hasTin) gaps.push("TIN");
      if (!context.hasSstRegistration) gaps.push("SST registration");
      if (!context.hasMsicCode) gaps.push("MSIC code");
      if (!context.hasAddress) gaps.push("business address");
      if (!context.hasRegistrationNumber) gaps.push("registration number");
      if (gaps.length === 0) return `${context.businessName} has the key e-invoice details in place: TIN, SST, MSIC code, address, and registration number.`;
      return `${context.businessName} still needs ${gaps.join(", ")} to be e-invoice ready. Add these in your business settings before submitting to MyInvois.`;
    },

    list_invoices: async () => {
      const invoices = await deps.listInvoices();
      if (invoices.length === 0) return "You don't have any invoices yet. Say \"create an invoice\" to start one.";
      const recent = [...invoices].sort((a, b) => b.issueDate.localeCompare(a.issueDate)).slice(0, 5);
      const lines = recent.map((invoice) => `${invoice.invoiceNumber} for ${invoice.customerName}, ${rm(invoice.total)}, ${invoice.status}`).join("; ");
      return `You have ${invoices.length} invoice${invoices.length === 1 ? "" : "s"}. Most recent: ${lines}.`;
    },

    list_recent_transactions: async (parameters) => {
      const limit = typeof parameters?.limit === "number" ? Math.min(Math.max(Math.trunc(parameters.limit), 1), 10) : 5;
      const transactions = [...(await deps.listTransactions())].sort((a, b) => b.date.localeCompare(a.date));
      if (transactions.length === 0) return "You have no records yet.";
      const lines = transactions.slice(0, limit).map((transaction) => transactionLabel(transaction)).join("; ");
      return `Your ${Math.min(limit, transactions.length)} most recent record${transactions.length === 1 ? "" : "s"}: ${lines}.`;
    },

    find_transactions: async (parameters) => {
      const parsed = findTransactionsSchema.safeParse(parameters ?? {});
      if (!parsed.success) return "Tell me what to look for — an amount, a description, or a name.";
      const limit = parsed.data.limit ?? 5;
      let transactions = await deps.listTransactions();
      if (parsed.data.type) transactions = transactions.filter((transaction) => transaction.type === parsed.data.type);
      const matches = searchTransactions(transactions, parsed.data.query ?? "", limit);
      if (matches.length === 0) return "I couldn't find any matching records.";
      const lines = matches.map((transaction) => `${transactionLabel(transaction)} [id ${transaction.id}]`).join("; ");
      return `Found ${matches.length} record${matches.length === 1 ? "" : "s"}: ${lines}. Tell me which one to edit or delete.`;
    },

    edit_transaction: async (parameters) => {
      if (!deps.updateTransaction) return "Editing saved records isn't available right now.";
      const parsed = targetTransactionSchema.safeParse(parameters ?? {});
      if (!parsed.success) return "Tell me which record to edit.";
      const transactions = await deps.listTransactions();
      const target = resolveTransaction(transactions, parsed.data);
      if (target.kind === "none") return "I couldn't find that record. Try find_transactions first.";
      if (target.kind === "many") return `I found ${target.matches.length} records that could match. ${target.matches.map((transaction) => `${transactionLabel(transaction)} [id ${transaction.id}]`).join("; ")}. Which one?`;
      const record = target.match;
      deps.draft.setTransaction({
        mode: "edit",
        editingId: record.id,
        type: record.type,
        amount: record.total,
        taxRate: record.subtotal > 0 ? round2((record.tax / record.subtotal) * 100) : 0,
        taxInclusive: false,
        quantity: null,
        unit: "",
        date: record.date,
        category: record.category,
        description: record.description,
        counterpartyId: record.counterpartyId ?? null,
        counterpartyName: record.counterpartyName,
        paymentMethod: record.paymentMethod ?? "",
        notes: record.notes ?? "",
        original: record,
      });
      return `Loaded ${transactionLabel(record)} for editing. Tell me what to change, then say "save it".`;
    },

    delete_transaction: async (parameters) => {
      if (!deps.removeTransaction) return "Deleting records isn't available right now.";
      const parsed = targetTransactionSchema.safeParse(parameters ?? {});
      if (!parsed.success) return "Tell me which record to delete.";
      const transactions = await deps.listTransactions();
      const target = resolveTransaction(transactions, parsed.data);
      if (target.kind === "none") return "I couldn't find that record. Try find_transactions first.";
      if (target.kind === "many") return `I found ${target.matches.length} records that could match. ${target.matches.map((transaction) => `${transactionLabel(transaction)} [id ${transaction.id}]`).join("; ")}. Which one?`;
      deps.draft.setPendingDelete({ kind: "transaction", id: target.match.id, label: transactionLabel(target.match) });
      return `You're about to delete ${transactionLabel(target.match)}. This can't be undone. Say "yes, delete it" to confirm.`;
    },

    confirm_delete: async () => {
      const pending = deps.draft.getPendingDelete();
      if (!pending) return "There's nothing staged to delete.";
      if (!deps.removeTransaction) return "Deleting records isn't available right now.";
      try {
        await deps.removeTransaction(pending.id);
        deps.draft.setPendingDelete(null);
        deps.draft.setLastConfirmation({ kind: "delete", label: pending.label });
        return `Deleted ${pending.label}. It's no longer in your records.`;
      } catch {
        return "I couldn't delete that just now. Please try again in a moment.";
      }
    },

    search_customers: async (parameters) => {
      if (!deps.listCustomers) return "Customer lookup isn't available right now.";
      const query = typeof parameters?.query === "string" ? parameters.query : typeof parameters?.name === "string" ? parameters.name : "";
      const customers = await deps.listCustomers();
      const matches = matchCustomers(customers, query, 5);
      if (matches.length === 0) return query ? `I couldn't find a customer matching "${query}".` : "You have no saved customers yet.";
      const list = matches.map((customer) => `${customer.name}${customer.tin ? ` (TIN ${customer.tin})` : ""}`).join("; ");
      return `Found ${matches.length} customer${matches.length === 1 ? "" : "s"}: ${list}.`;
    },

    create_customer: (parameters) => {
      const parsed = customerDraftSchema.safeParse(parameters);
      if (!parsed.success) return "Tell me the customer's name at least, and their TIN if you have it.";
      const draft: VoiceCustomerDraft = {
        name: parsed.data.name,
        email: parsed.data.email ?? null,
        phone: parsed.data.phone ?? null,
        tin: parsed.data.tin ?? null,
        registrationNumber: parsed.data.registrationNumber ?? null,
        address: parsed.data.address ?? null,
      };
      deps.draft.setCustomer(draft);
      return `I've staged a new customer: ${draft.name}${draft.tin ? `, TIN ${draft.tin}` : ""}. Say "confirm the customer" to save it.`;
    },

    confirm_customer: async () => {
      const draft = deps.draft.getCustomer();
      if (!draft) return "There's no customer staged to confirm.";
      if (!deps.createCustomer) return "Saving customers isn't available right now.";
      try {
        const created = await deps.createCustomer({
          name: draft.name,
          email: draft.email,
          phone: draft.phone,
          tin: draft.tin,
          registrationNumber: draft.registrationNumber,
          address: draft.address,
        });
        deps.draft.setCustomer(null);
        deps.draft.setLastConfirmation({ kind: "customer", label: created.name });
        return `Saved ${created.name} as a customer. You can invoice them by name now.`;
      } catch {
        return "I couldn't save that customer just now. Please try again in a moment.";
      }
    },

    list_receivables: async () => {
      const balances = outstandingBalances(await deps.listInvoices(), today());
      if (balances.length === 0) return "No customers currently owe you on issued invoices.";
      const totalOutstanding = balances.reduce((sum, balance) => sum + balance.outstanding, 0);
      const overdue = balances.filter((balance) => balance.overdue).length;
      const top = balances.slice(0, 3).map((balance) => `${balance.customerName} owes ${rm(balance.outstanding)}${balance.overdue ? " (overdue)" : ""}`).join("; ");
      return `${balances.length} outstanding invoice${balances.length === 1 ? "" : "s"} totalling ${rm(totalOutstanding)}${overdue ? `, ${overdue} overdue` : ""}. ${top}.`;
    },

    draft_reminder: async (parameters) => {
      const parsed = reminderSchema.safeParse(parameters ?? {});
      if (!parsed.success) return "Tell me which customer or invoice number you'd like to remind.";
      const balances = outstandingBalances(await deps.listInvoices(), today());
      const match = findBalance(balances, parsed.data) ?? balances[0];
      if (!match) return "I couldn't find an outstanding invoice to remind about.";
      const due = match.overdue ? `was due on ${match.dueDate}` : `is due on ${match.dueDate}`;
      const message = `Hi ${match.customerName}, a friendly reminder that ${rm(match.outstanding)} on invoice ${match.invoiceNumber} ${due}. Please let us know if you need any details. Thank you.`;
      deps.draft.setReminder({ invoiceId: match.invoiceId, invoiceNumber: match.invoiceNumber, customerName: match.customerName, customerEmail: match.customerEmail, message });
      return `Here's a draft reminder for ${match.customerName}: "${message}" Say "send it" to mark the reminder as sent, or tell me what to change.`;
    },

    send_reminder: async (parameters) => {
      if (!deps.markReminderSent) return "Sending reminders isn't available right now.";
      const parsed = reminderSchema.safeParse(parameters ?? {});
      const staged = deps.draft.getReminder();
      const invoices = await deps.listInvoices();
      let invoice: Invoice | undefined;
      let message: string;
      if (staged && (!parsed.success || (!parsed.data.customerName && !parsed.data.invoiceNumber))) {
        invoice = invoices.find((item) => item.id === staged.invoiceId);
        message = staged.message;
      } else if (parsed.success) {
        const balances = outstandingBalances(invoices, today());
        const match = findBalance(balances, parsed.data);
        if (!match) return "I couldn't find that invoice to send a reminder for.";
        invoice = invoices.find((item) => item.id === match.invoiceId);
        message = `Hi ${match.customerName}, a friendly reminder that ${rm(match.outstanding)} on invoice ${match.invoiceNumber} ${match.overdue ? `was due on ${match.dueDate}` : `is due on ${match.dueDate}`}. Thank you.`;
      } else {
        return "Tell me which customer or invoice to remind.";
      }
      if (!invoice) return "I couldn't find that invoice to send a reminder for.";
      try {
        await deps.markReminderSent(invoice, message);
        deps.draft.setReminder(null);
        deps.draft.setLastConfirmation({ kind: "reminder", label: `${invoice.invoiceNumber} to ${invoice.customerName}` });
        return `Marked a reminder as sent to ${invoice.customerName} for invoice ${invoice.invoiceNumber}.`;
      } catch {
        return "I couldn't record that reminder just now. Please try again in a moment.";
      }
    },

    record_invoice_payment: async (parameters) => {
      const parsed = paymentSchema.safeParse(parameters ?? {});
      if (!parsed.success) return "Tell me the customer or invoice number and how much they paid.";
      const invoices = await deps.listInvoices();
      const balances = outstandingBalances(invoices, today());
      const match = findBalance(balances, parsed.data);
      if (!match) return "I couldn't find an unpaid invoice for that customer.";
      const invoice = invoices.find((item) => item.id === match.invoiceId);
      if (!invoice) return "I couldn't find that invoice.";
      const outstanding = round2(invoice.total - invoice.amountPaid);
      const amount = round2(parsed.data.amount ?? outstanding);
      if (amount > outstanding + 0.005) return `That's more than the ${rm(outstanding)} still outstanding on invoice ${invoice.invoiceNumber}. Tell me an amount up to ${rm(outstanding)}.`;
      deps.draft.setPendingPayment({ invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, customerName: invoice.customerName, amount, currentPaid: invoice.amountPaid, total: invoice.total });
      const remaining = round2(outstanding - amount);
      return `I've staged a ${rm(amount)} payment for invoice ${invoice.invoiceNumber} from ${invoice.customerName}${remaining > 0.005 ? `, leaving ${rm(remaining)} outstanding` : `, which clears it`}. Say "confirm the payment" to record it. Note: in demo mode this updates the invoice status only.`;
    },

    confirm_invoice_payment: async () => {
      const pending = deps.draft.getPendingPayment();
      if (!pending) return "There's no payment staged to confirm.";
      if (!deps.updateInvoice) return "Recording payments isn't available right now.";
      const invoices = await deps.listInvoices();
      const invoice = invoices.find((item) => item.id === pending.invoiceId);
      if (!invoice) return "I couldn't find that invoice to record the payment against.";
      const newPaid = round2(Math.min(invoice.amountPaid + pending.amount, invoice.total));
      const status: Invoice["status"] = newPaid + 0.005 >= invoice.total ? "paid" : "partially_paid";
      try {
        const updated = await deps.updateInvoice({ ...invoice, amountPaid: newPaid, status });
        deps.draft.setPendingPayment(null);
        deps.draft.setLastConfirmation({ kind: "payment", label: `${rm(pending.amount)} to ${updated.invoiceNumber}` });
        return `Recorded ${rm(pending.amount)} against invoice ${updated.invoiceNumber}. It's now ${status === "paid" ? "fully paid" : `partially paid, ${rm(round2(updated.total - updated.amountPaid))} still outstanding`}.`;
      } catch {
        return "I couldn't record that payment just now. Please try again in a moment.";
      }
    },

    create_invoice_draft: async (parameters) => {
      const parsed = invoiceDraftSchema.safeParse(parameters);
      if (!parsed.success) return "I couldn't read those invoice details. Please give me the customer name and at least one line item with a price.";
      const issueDate = parsed.data.issueDate ?? today();
      let customerId: string | null = null;
      let customerEmail = parsed.data.customerEmail ?? null;
      let buyerTin = parsed.data.buyerTin ?? null;
      if (deps.listCustomers) {
        try {
          const match = matchCustomers(await deps.listCustomers(), parsed.data.customerName, 1)[0];
          if (match) {
            customerId = match.id;
            customerEmail = customerEmail ?? match.email;
            buyerTin = buyerTin ?? match.tin;
          }
        } catch {
          // A failed lookup shouldn't block staging; the owner can still review and send.
        }
      }
      const draft: VoiceInvoiceDraft = {
        customerId,
        customerName: parsed.data.customerName,
        customerEmail,
        buyerTin,
        issueDate,
        dueDate: parsed.data.dueDate ?? addIsoDays(issueDate, 14),
        paymentTerms: parsed.data.paymentTerms ?? DEFAULT_PAYMENT_TERMS,
        prepaymentAmount: parsed.data.prepaymentAmount ?? 0,
        items: parsed.data.items.map(toVoiceInvoiceLine),
        notes: parsed.data.notes ?? null,
      };
      deps.draft.setInvoice(draft);
      const totals = calculateInvoiceTotals(draft.items);
      const tinText = draft.buyerTin ? ` Buyer TIN ${draft.buyerTin} is attached.` : " No buyer TIN on file yet.";
      return `I've staged an invoice for ${draft.customerName} with ${draft.items.length} line item${draft.items.length === 1 ? "" : "s"}, totalling ${rm(totals.total)}.${tinText} Say "confirm the invoice" to save it as a draft, or tell me what to change.`;
    },

    update_invoice_draft: async (parameters) => {
      const draft = deps.draft.getInvoice();
      if (!draft) return "There's no invoice staged yet. Say \"create an invoice\" first.";
      const parsed = invoicePatchSchema.safeParse(parameters ?? {});
      if (!parsed.success) return "I couldn't read that change. Tell me the field and its new value.";
      const patch: Partial<VoiceInvoiceDraft> = {};
      if (parsed.data.issueDate) patch.issueDate = parsed.data.issueDate;
      if (parsed.data.dueDate) patch.dueDate = parsed.data.dueDate;
      if (parsed.data.paymentTerms !== undefined) patch.paymentTerms = parsed.data.paymentTerms;
      if (parsed.data.prepaymentAmount !== undefined) patch.prepaymentAmount = parsed.data.prepaymentAmount;
      if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes;
      if (parsed.data.customerName) {
        patch.customerName = parsed.data.customerName;
        patch.customerId = null;
        patch.buyerTin = null;
        patch.customerEmail = null;
        if (deps.listCustomers) {
          try {
            const match = matchCustomers(await deps.listCustomers(), parsed.data.customerName, 1)[0];
            if (match) {
              patch.customerId = match.id;
              patch.buyerTin = match.tin;
              patch.customerEmail = match.email;
            }
          } catch {
            // Ignore lookup failure; keep the typed name.
          }
        }
      }
      deps.draft.patchInvoice(patch);
      const updated = deps.draft.getInvoice();
      const totals = updated ? calculateInvoiceTotals(updated.items) : { total: 0 };
      return `Updated the invoice for ${updated?.customerName}. It now totals ${rm(totals.total)}, due ${updated?.dueDate}.`;
    },

    add_invoice_line_item: (parameters) => {
      const draft = deps.draft.getInvoice();
      if (!draft) return "There's no invoice staged yet. Say \"create an invoice\" first.";
      const parsed = invoiceLineSchema.safeParse(parameters);
      if (!parsed.success) return "Tell me the item description, quantity, and unit price.";
      const items = [...draft.items, toVoiceInvoiceLine(parsed.data)];
      deps.draft.patchInvoice({ items });
      const totals = calculateInvoiceTotals(items);
      return `Added ${parsed.data.quantity} × ${parsed.data.description}. The invoice now has ${items.length} line items totalling ${rm(totals.total)}.`;
    },

    remove_invoice_line_item: (parameters) => {
      const draft = deps.draft.getInvoice();
      if (!draft) return "There's no invoice staged yet.";
      if (draft.items.length <= 1) return "An invoice needs at least one line item. Change it instead, or discard the invoice.";
      const description = typeof parameters?.description === "string" ? parameters.description.toLowerCase() : "";
      const index = typeof parameters?.index === "number" ? Math.trunc(parameters.index) - 1 : draft.items.findIndex((item) => item.description.toLowerCase().includes(description));
      if (index < 0 || index >= draft.items.length) return "I couldn't find that line item. Tell me its description or position.";
      const removed = draft.items[index];
      const items = draft.items.filter((_, position) => position !== index);
      deps.draft.patchInvoice({ items });
      const totals = calculateInvoiceTotals(items);
      return `Removed ${removed.description}. The invoice now totals ${rm(totals.total)} across ${items.length} line item${items.length === 1 ? "" : "s"}.`;
    },

    confirm_invoice: async () => {
      const draft = deps.draft.getInvoice();
      if (!draft) return "There's no invoice staged to confirm yet.";
      try {
        const invoiceNumber = await deps.nextInvoiceNumber();
        const created = await deps.createInvoice({
          businessId: deps.businessId,
          customerId: draft.customerId,
          invoiceNumber,
          customerName: draft.customerName,
          customerEmail: draft.customerEmail,
          buyerTin: draft.buyerTin,
          issueDate: draft.issueDate,
          dueDate: draft.dueDate,
          status: "draft",
          currency: "MYR",
          items: draft.items.map((item) => ({
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
          prepaymentAmount: draft.prepaymentAmount,
          notes: draft.notes,
          paymentTerms: draft.paymentTerms,
        });
        deps.draft.clearInvoice();
        deps.draft.setLastConfirmation({ kind: "invoice", label: `${created.invoiceNumber} for ${created.customerName}` });
        return `Saved invoice ${created.invoiceNumber} for ${created.customerName} totalling ${rm(created.total)} as a draft. Review and send it from the e-Invoice page.`;
      } catch {
        return "I couldn't save that invoice just now. Please try again in a moment.";
      }
    },

    navigate: (parameters) => {
      const parsed = navigateSchema.safeParse(parameters);
      if (!parsed.success) return "Where would you like to go? Try the dashboard, records, or invoices.";
      const key = parsed.data.destination.toLowerCase().replace(/[^a-z-]/g, "");
      const href = NAV_DESTINATIONS[key];
      if (!href) return "I can open the dashboard, records, invoices, reminders, or business details.";
      deps.navigate(href);
      return `Opening ${parsed.data.destination}.`;
    },

    get_current_context: () => {
      const { pathname, businessName } = deps.getContext();
      const page = Object.entries(NAV_DESTINATIONS).find(([, href]) => href === pathname)?.[0] ?? "the app";
      return `You're working in ${businessName} and currently viewing ${page}. Today is ${today()}.`;
    },
  };
}
