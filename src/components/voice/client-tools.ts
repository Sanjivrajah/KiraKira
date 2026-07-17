import { z } from "zod";
import { makeEntityId } from "@/services/id";
import { formatMoney } from "@/lib/format/money";
import type { Invoice, Transaction } from "@/types";
import {
  kualaLumpurToday,
  outstandingBalances,
  resolveFinancePeriod,
  summarizeTransactions,
  type FinancePeriodKey,
} from "./voice-finance";
import type {
  VoiceConfirmation,
  VoiceInvoiceDraft,
  VoiceReminderDraft,
  VoiceTransactionDraft,
} from "./voice-draft-store";

type NewTransaction = Omit<Transaction, "id" | "createdAt" | "updatedAt">;
type NewInvoice = Omit<Invoice, "id" | "createdAt" | "updatedAt" | "subtotal" | "tax" | "total">;

/** Client-side draft controller the tools mutate; backed by the Zustand store at runtime. */
export interface VoiceDraftController {
  setTransaction(draft: VoiceTransactionDraft): void;
  patchTransaction(patch: Partial<VoiceTransactionDraft>): void;
  getTransaction(): VoiceTransactionDraft | null;
  clearTransaction(): void;
  setInvoice(draft: VoiceInvoiceDraft): void;
  getInvoice(): VoiceInvoiceDraft | null;
  clearInvoice(): void;
  setReminder(draft: VoiceReminderDraft | null): void;
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

const transactionDraftSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.coerce.number().positive().max(10_000_000).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  category: z.string().trim().max(60).optional(),
  description: z.string().trim().max(160).optional(),
  counterpartyName: z.string().trim().max(100).optional(),
  paymentMethod: z.string().trim().max(60).optional(),
});

const invoiceLineSchema = z.object({
  description: z.string().trim().min(1).max(160),
  quantity: z.coerce.number().positive().max(100_000),
  unitPrice: z.coerce.number().nonnegative().max(10_000_000),
  taxRate: z.coerce.number().min(0).max(100).optional(),
});

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
  customerName: z.string().trim().min(1).max(100),
  customerEmail: z.string().trim().max(160).optional(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  items: invoiceItemsSchema,
  notes: z.string().trim().max(500).optional(),
});

const financeQuerySchema = z.object({
  period: z.enum(periodKeys as [FinancePeriodKey, ...FinancePeriodKey[]]).optional(),
});

const reminderSchema = z.object({
  customerName: z.string().trim().max(100).optional(),
  invoiceNumber: z.string().trim().max(60).optional(),
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
  const how = draft.paymentMethod ? ` paid by ${draft.paymentMethod}` : "";
  return `${flow} of ${amount} for ${draft.description || draft.category || "a transaction"}${who}${how} on ${draft.date}`;
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
        type: parsed.data.type,
        amount: parsed.data.amount ?? null,
        date: parsed.data.date ?? today(),
        category: parsed.data.category ?? "",
        description: parsed.data.description ?? "",
        counterpartyName: parsed.data.counterpartyName ?? "",
        paymentMethod: parsed.data.paymentMethod ?? "",
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
      if (parsed.data.date) patch.date = parsed.data.date;
      if (parsed.data.category !== undefined) patch.category = parsed.data.category;
      if (parsed.data.description !== undefined) patch.description = parsed.data.description;
      if (parsed.data.counterpartyName !== undefined) patch.counterpartyName = parsed.data.counterpartyName;
      if (parsed.data.paymentMethod !== undefined) patch.paymentMethod = parsed.data.paymentMethod;
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
      try {
        const created = await deps.createTransaction({
          businessId: deps.businessId,
          createdBy: deps.createdBy,
          type: draft.type,
          subtotal: draft.amount,
          tax: 0,
          total: draft.amount,
          currency: "MYR",
          date: draft.date,
          category: draft.category,
          description: draft.description,
          counterpartyName: draft.counterpartyName,
          paymentMethod: draft.paymentMethod || null,
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
      const period = resolveFinancePeriod(key, deps.now?.() ?? new Date());
      const summary = summarizeTransactions(await deps.listTransactions(), period);
      if (summary.transactionCount === 0) return `You have no confirmed records for ${period.label}.`;
      const top = summary.topExpenseCategories[0];
      const topText = top ? ` Your biggest expense was ${top[0]} at ${rm(top[1])}.` : "";
      return `For ${period.label}: money in ${rm(summary.income)}, money out ${rm(summary.expenses)}, estimated profit ${rm(summary.estimatedProfit)}, across ${summary.transactionCount} record${summary.transactionCount === 1 ? "" : "s"}.${topText}`;
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
      const match = balances.find((balance) => {
        if (parsed.data.invoiceNumber && balance.invoiceNumber.toLowerCase() === parsed.data.invoiceNumber.toLowerCase()) return true;
        if (parsed.data.customerName) return balance.customerName.toLowerCase().includes(parsed.data.customerName.toLowerCase());
        return false;
      }) ?? balances[0];
      if (!match) return "I couldn't find an outstanding invoice to remind about.";
      const due = match.overdue ? `was due on ${match.dueDate}` : `is due on ${match.dueDate}`;
      const message = `Hi ${match.customerName}, a friendly reminder that ${rm(match.outstanding)} on invoice ${match.invoiceNumber} ${due}. Please let us know if you need any details. Thank you.`;
      deps.draft.setReminder({ customerName: match.customerName, message });
      return `Here's a draft reminder for ${match.customerName}: "${message}" I've put it on screen — sending isn't wired up in this demo.`;
    },

    create_invoice_draft: (parameters) => {
      const parsed = invoiceDraftSchema.safeParse(parameters);
      if (!parsed.success) return "I couldn't read those invoice details. Please give me the customer name and at least one line item with a price.";
      const issueDate = parsed.data.issueDate ?? today();
      const draft: VoiceInvoiceDraft = {
        customerName: parsed.data.customerName,
        customerEmail: parsed.data.customerEmail ?? null,
        issueDate,
        dueDate: parsed.data.dueDate ?? issueDate,
        items: parsed.data.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate ?? 0,
        })),
        notes: parsed.data.notes ?? null,
      };
      deps.draft.setInvoice(draft);
      const total = draft.items.reduce((sum, item) => sum + item.quantity * item.unitPrice * (1 + item.taxRate / 100), 0);
      return `I've staged an invoice for ${draft.customerName} with ${draft.items.length} line item${draft.items.length === 1 ? "" : "s"}, roughly ${rm(Math.round(total * 100) / 100)}. Say "confirm the invoice" to save it as a draft, or tell me what to change.`;
    },

    confirm_invoice: async () => {
      const draft = deps.draft.getInvoice();
      if (!draft) return "There's no invoice staged to confirm yet.";
      try {
        const invoiceNumber = await deps.nextInvoiceNumber();
        const created = await deps.createInvoice({
          businessId: deps.businessId,
          customerId: null,
          invoiceNumber,
          customerName: draft.customerName,
          customerEmail: draft.customerEmail,
          buyerTin: null,
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
          })),
          amountPaid: 0,
          notes: draft.notes,
          paymentTerms: null,
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
