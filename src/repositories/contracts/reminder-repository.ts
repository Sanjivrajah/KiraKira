import type { Reminder } from "@/types";

export interface ReminderRepository {
  list(input: { businessId: string; invoiceId?: string }): Promise<Reminder[]>;
  getById(input: { businessId: string; reminderId: string }): Promise<Reminder | null>;
  create(input: { reminder: Reminder }): Promise<Reminder>;
  update(input: { businessId: string; reminderId: string; changes: Partial<Reminder> }): Promise<Reminder>;
  remove(input: { businessId: string; reminderId: string }): Promise<void>;
  removeForInvoice(input: { businessId: string; invoiceId: string }): Promise<void>;
  clearForBusiness(input: { businessId: string }): Promise<void>;
  clear(): Promise<void>;
}
