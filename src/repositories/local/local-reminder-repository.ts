import { browserStorage, type KeyValueStorage } from "@/lib/storage/browser-storage";
import { STORAGE_KEYS } from "@/lib/storage/storage-keys";
import type { ReminderRepository } from "@/repositories/contracts";
import type { Reminder } from "@/types";
import { LocalEntityStore } from "./local-entity-store";
import { parseReminder } from "./parsers";

export class LocalReminderRepository extends LocalEntityStore<Reminder> implements ReminderRepository {
  constructor(storage: KeyValueStorage = browserStorage) { super(STORAGE_KEYS.reminders, storage, parseReminder); }
  async list({ businessId, invoiceId }: { businessId: string; invoiceId?: string }) { return this.readAll().filter((item) => item.businessId === businessId && (!invoiceId || item.invoiceId === invoiceId)); }
  async getById({ businessId, reminderId }: { businessId: string; reminderId: string }) { return this.readAll().find((item) => item.businessId === businessId && item.id === reminderId) ?? null; }
  async create({ reminder }: { reminder: Reminder }) { return this.createEntity(reminder); }
  async update({ businessId, reminderId, changes }: { businessId: string; reminderId: string; changes: Partial<Reminder> }) { return this.updateEntity(reminderId, { ...changes, businessId }, businessId); }
  async remove({ businessId, reminderId }: { businessId: string; reminderId: string }) { this.removeEntity(reminderId, businessId); }
  async removeForInvoice({ businessId, invoiceId }: { businessId: string; invoiceId: string }) { this.writeAll(this.readAll().filter((item) => item.businessId !== businessId || item.invoiceId !== invoiceId)); }
  async clearForBusiness({ businessId }: { businessId: string }) { this.writeAll(this.readAll().filter((item) => item.businessId !== businessId)); }
  async clear() { this.clearAll(); }
}
