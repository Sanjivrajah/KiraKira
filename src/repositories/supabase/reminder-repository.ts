import type { Database, Json } from "@/lib/supabase/database.types";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import type { ReminderRepository } from "@/repositories/contracts";
import type { Reminder } from "@/types";

type ReminderRow = Database["public"]["Tables"]["payment_reminders"]["Row"];
type ReminderWithInvoice = ReminderRow & { invoices: { customer_snapshot: Json } | null };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function customerName(snapshot: Json | undefined) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return "Invoice recipient";
  const name = (snapshot as Record<string, Json>).name;
  return typeof name === "string" && name.trim() ? name : "Invoice recipient";
}

function toReminder(row: ReminderWithInvoice): Reminder {
  return {
    businessId: row.business_id,
    channel: row.channel as Reminder["channel"],
    createdAt: row.created_at,
    id: row.id,
    invoiceId: row.invoice_id ?? "",
    messagePreview: row.message_snapshot,
    recipient: customerName(row.invoices?.customer_snapshot),
    scheduledAt: row.scheduled_for,
    sentAt: row.status === "sent" ? row.updated_at : null,
    status: row.status as Reminder["status"],
    templateKey: null,
    updatedAt: row.updated_at,
  };
}

/** Supabase-backed reminder records. No operation falls back to browser storage. */
export class SupabaseReminderRepository implements ReminderRepository {
  private get client() { return getSupabaseBrowserClient(); }

  async list({ businessId, invoiceId }: { businessId: string; invoiceId?: string }) {
    let query = this.client
      .from("payment_reminders")
      .select("*,invoices(customer_snapshot)")
      .eq("business_id", businessId)
      .order("scheduled_for", { ascending: false });
    if (invoiceId) query = query.eq("invoice_id", invoiceId);
    const { data, error } = await query;
    if (error) throw new Error(`Could not load reminders: ${error.message}`);
    return (data as unknown as ReminderWithInvoice[]).map(toReminder);
  }

  async getById({ businessId, reminderId }: { businessId: string; reminderId: string }) {
    const { data, error } = await this.client
      .from("payment_reminders")
      .select("*,invoices(customer_snapshot)")
      .eq("business_id", businessId)
      .eq("id", reminderId)
      .maybeSingle();
    if (error) throw new Error(`Could not load reminder: ${error.message}`);
    return data ? toReminder(data as unknown as ReminderWithInvoice) : null;
  }

  async create({ reminder }: { reminder: Reminder }) {
    const { data, error } = await this.client
      .from("payment_reminders")
      .insert({
        ...(uuidPattern.test(reminder.id) ? { id: reminder.id } : {}),
        business_id: reminder.businessId,
        channel: reminder.channel,
        invoice_id: reminder.invoiceId,
        message_snapshot: reminder.messagePreview ?? "",
        scheduled_for: reminder.scheduledAt ?? reminder.sentAt ?? new Date().toISOString(),
        status: reminder.status,
      })
      .select("*,invoices(customer_snapshot)")
      .single();
    if (error) throw new Error(`Could not save reminder: ${error.message}`);
    return toReminder(data as unknown as ReminderWithInvoice);
  }

  async update({ businessId, reminderId, changes }: { businessId: string; reminderId: string; changes: Partial<Reminder> }) {
    const update: Database["public"]["Tables"]["payment_reminders"]["Update"] = {};
    if (changes.channel !== undefined) update.channel = changes.channel;
    if (changes.invoiceId !== undefined) update.invoice_id = changes.invoiceId;
    if (changes.messagePreview !== undefined) update.message_snapshot = changes.messagePreview ?? "";
    if (changes.scheduledAt !== undefined) update.scheduled_for = changes.scheduledAt ?? new Date().toISOString();
    if (changes.status !== undefined) update.status = changes.status;
    const { data, error } = await this.client
      .from("payment_reminders")
      .update(update)
      .eq("business_id", businessId)
      .eq("id", reminderId)
      .select("*,invoices(customer_snapshot)")
      .single();
    if (error) throw new Error(`Could not update reminder: ${error.message}`);
    return toReminder(data as unknown as ReminderWithInvoice);
  }

  async remove({ businessId, reminderId }: { businessId: string; reminderId: string }) {
    const { error } = await this.client.from("payment_reminders").delete().eq("business_id", businessId).eq("id", reminderId);
    if (error) throw new Error(`Could not remove reminder: ${error.message}`);
  }

  async removeForInvoice({ businessId, invoiceId }: { businessId: string; invoiceId: string }) {
    const { error } = await this.client.from("payment_reminders").delete().eq("business_id", businessId).eq("invoice_id", invoiceId);
    if (error) throw new Error(`Could not remove invoice reminders: ${error.message}`);
  }

  async clearForBusiness() { throw new Error("Clearing server reminders is not supported."); }
  async clear() { throw new Error("Clearing server reminders is not supported."); }
}
