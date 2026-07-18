import { join } from "node:path";
import { z } from "zod";
import { JsonArrayStore, withLocalStorageLock } from "@/lib/storage/json-store";

const moneySchema = z.number().finite().positive().multipleOf(0.01);
const isoDateSchema = z.string().date();
const timestampSchema = z.string().datetime();

export const receivableStatusSchema = z.enum(["open", "partially_paid", "paid", "voided"]);
export const receivableSchema = z.object({
  id: z.string().uuid(),
  telegramUserId: z.string().min(1),
  telegramChatId: z.string().min(1),
  customerDisplayName: z.string().trim().min(1).max(160),
  originalAmount: moneySchema,
  outstandingAmount: z.number().finite().min(0).multipleOf(0.01),
  currency: z.literal("MYR"),
  issuedOn: isoDateSchema,
  dueOn: isoDateSchema.nullable(),
  status: receivableStatusSchema,
  notes: z.string().trim().max(500).nullable(),
  source: z.literal("telegram"),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  settledAt: timestampSchema.nullable(),
  voidedAt: timestampSchema.nullable(),
  voidReason: z.string().trim().min(1).max(280).nullable(),
}).superRefine((value, ctx) => {
  if (value.dueOn && value.dueOn < value.issuedOn) ctx.addIssue({ code: "custom", path: ["dueOn"], message: "Due date cannot be before the issue date." });
  if (value.status === "paid" && (value.outstandingAmount !== 0 || !value.settledAt)) ctx.addIssue({ code: "custom", message: "Paid receivables must be settled." });
  if (value.status === "voided" && (!value.voidedAt || !value.voidReason)) ctx.addIssue({ code: "custom", message: "Voided receivables need audit details." });
});
export type Receivable = z.infer<typeof receivableSchema>;

export const receivablePaymentSchema = z.object({
  id: z.string().uuid(),
  receivableId: z.string().uuid(),
  telegramUserId: z.string().min(1),
  telegramChatId: z.string().min(1),
  amount: moneySchema,
  paidOn: isoDateSchema,
  paymentMethod: z.enum(["cash", "bank_transfer", "card", "ewallet", "credit", "unknown"]),
  reference: z.string().trim().max(160).nullable(),
  idempotencyKey: z.string().trim().min(1).max(160),
  createdAt: timestampSchema,
});
export type ReceivablePayment = z.infer<typeof receivablePaymentSchema>;

export interface ReceivableRepository {
  ensure(): Promise<void>;
  create(receivable: Receivable): Promise<Receivable>;
  update(receivable: Receivable): Promise<Receivable>;
  findById(id: string): Promise<Receivable | null>;
  listByOwner(telegramUserId: string, telegramChatId: string): Promise<Receivable[]>;
  createPayment(payment: ReceivablePayment): Promise<ReceivablePayment>;
  listPayments(receivableId: string): Promise<ReceivablePayment[]>;
  findPaymentByIdempotencyKey(key: string): Promise<ReceivablePayment | null>;
}

/** Local-mode projection of the existing invoice/invoice_payment lifecycle. */
export class LocalReceivableRepository implements ReceivableRepository {
  private readonly receivables = new JsonArrayStore<Receivable>(join(this.directory, "receivables.json"));
  private readonly payments = new JsonArrayStore<ReceivablePayment>(join(this.directory, "receivable-payments.json"));
  constructor(private readonly directory: string) {}
  async ensure() { await Promise.all([this.readReceivables(), this.readPayments()]); }
  async create(value: Receivable) { const parsed = receivableSchema.parse(value); return withLocalStorageLock(async () => { const values = await this.readReceivables(); if (values.some((item) => item.id === parsed.id)) throw new Error("Receivable already exists."); values.push(parsed); await this.receivables.write(values); return parsed; }); }
  async update(value: Receivable) { const parsed = receivableSchema.parse(value); return withLocalStorageLock(async () => { const values = await this.readReceivables(); const index = values.findIndex((item) => item.id === parsed.id); if (index < 0) throw new Error("Receivable no longer exists."); values[index] = parsed; await this.receivables.write(values); return parsed; }); }
  async findById(id: string) { return (await this.readReceivables()).find((item) => item.id === id) ?? null; }
  async listByOwner(userId: string, chatId: string) { return (await this.readReceivables()).filter((item) => item.telegramUserId === userId && item.telegramChatId === chatId); }
  async createPayment(value: ReceivablePayment) { const parsed = receivablePaymentSchema.parse(value); return withLocalStorageLock(async () => { const values = await this.readPayments(); const existing = values.find((item) => item.idempotencyKey === parsed.idempotencyKey); if (existing) return existing; values.push(parsed); await this.payments.write(values); return parsed; }); }
  async listPayments(receivableId: string) { return (await this.readPayments()).filter((item) => item.receivableId === receivableId); }
  async findPaymentByIdempotencyKey(key: string) { return (await this.readPayments()).find((item) => item.idempotencyKey === key) ?? null; }
  private async readReceivables() { return (await this.receivables.read()).map((value) => receivableSchema.parse(value)); }
  private async readPayments() { return (await this.payments.read()).map((value) => receivablePaymentSchema.parse(value)); }
}

export function isOverdue(receivable: Receivable, today: string): boolean { return receivable.status !== "paid" && receivable.status !== "voided" && Boolean(receivable.dueOn && receivable.dueOn < today); }
export function outstandingReceivables(receivables: readonly Receivable[], today: string) { return receivables.filter((item) => item.status !== "voided" && item.outstandingAmount > 0).sort((a, b) => Number(isOverdue(b, today)) - Number(isOverdue(a, today)) || (a.dueOn ?? "9999-12-31").localeCompare(b.dueOn ?? "9999-12-31")).slice(0, 30); }
export function findCustomerMatches(receivables: readonly Receivable[], customer: string): Receivable[] { const needle = customer.normalize("NFKD").toLocaleLowerCase().trim(); return receivables.filter((item) => item.status !== "voided" && item.outstandingAmount > 0 && item.customerDisplayName.normalize("NFKD").toLocaleLowerCase().includes(needle)); }
export function draftReminder(receivable: Receivable, today: string): string {
  const due = receivable.dueOn ? (isOverdue(receivable, today) ? `was due on ${receivable.dueOn}` : `is due on ${receivable.dueOn}`) : "is outstanding";
  return `Hi ${receivable.customerDisplayName}, a friendly reminder that RM${receivable.outstandingAmount.toFixed(2)} ${due}. Please let us know if you need any details. Thank you.`;
}

export class ReceivableService {
  constructor(private readonly repository: ReceivableRepository, private readonly now: () => Date = () => new Date()) {}
  async create(input: { telegramUserId: string; telegramChatId: string; customerDisplayName: string; amount: number; issuedOn: string; dueOn?: string | null; notes?: string | null }) {
    const timestamp = this.now().toISOString();
    const receivable = receivableSchema.parse({ id: crypto.randomUUID(), telegramUserId: input.telegramUserId, telegramChatId: input.telegramChatId, customerDisplayName: input.customerDisplayName, originalAmount: input.amount, outstandingAmount: input.amount, currency: "MYR", issuedOn: input.issuedOn, dueOn: input.dueOn ?? null, status: "open", notes: input.notes?.trim() || null, source: "telegram", createdAt: timestamp, updatedAt: timestamp, settledAt: null, voidedAt: null, voidReason: null });
    await this.repository.ensure(); return this.repository.create(receivable);
  }
  async recordPayment(input: { receivableId: string; telegramUserId: string; telegramChatId: string; amount: number; paidOn: string; paymentMethod: ReceivablePayment["paymentMethod"]; reference?: string | null; idempotencyKey: string }) {
    const existing = await this.repository.findPaymentByIdempotencyKey(input.idempotencyKey); if (existing) return { outcome: "duplicate" as const, payment: existing };
    const receivable = await this.repository.findById(input.receivableId);
    if (!receivable) return { outcome: "missing" as const };
    if (receivable.telegramUserId !== input.telegramUserId || receivable.telegramChatId !== input.telegramChatId) return { outcome: "not_owner" as const };
    if (receivable.status === "voided" || receivable.status === "paid") return { outcome: "closed" as const };
    if (input.amount > receivable.outstandingAmount) return { outcome: "overpayment" as const, outstandingAmount: receivable.outstandingAmount };
    const timestamp = this.now().toISOString(); const outstandingAmount = Math.round((receivable.outstandingAmount - input.amount) * 100) / 100;
    const payment = await this.repository.createPayment({ id: crypto.randomUUID(), receivableId: receivable.id, telegramUserId: input.telegramUserId, telegramChatId: input.telegramChatId, amount: input.amount, paidOn: input.paidOn, paymentMethod: input.paymentMethod, reference: input.reference?.trim() || null, idempotencyKey: input.idempotencyKey, createdAt: timestamp });
    const next = await this.repository.update({ ...receivable, outstandingAmount, status: outstandingAmount === 0 ? "paid" : "partially_paid", settledAt: outstandingAmount === 0 ? timestamp : null, updatedAt: timestamp });
    return { outcome: "recorded" as const, payment, receivable: next };
  }
  async void(input: { receivableId: string; telegramUserId: string; telegramChatId: string; reason: string }) {
    const receivable = await this.repository.findById(input.receivableId); if (!receivable) return "missing" as const;
    if (receivable.telegramUserId !== input.telegramUserId || receivable.telegramChatId !== input.telegramChatId) return "not_owner" as const;
    if (receivable.status === "paid" || receivable.status === "voided") return "closed" as const;
    const timestamp = this.now().toISOString(); return this.repository.update({ ...receivable, status: "voided", voidedAt: timestamp, voidReason: input.reason.trim() || "Owner requested void", updatedAt: timestamp });
  }
}
