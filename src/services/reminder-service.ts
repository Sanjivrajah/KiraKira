import type { ReminderRepository } from "@/repositories/contracts";
import type { Invoice, Reminder } from "@/types";
import { makeEntityId } from "./id";

export class ReminderService {
  constructor(private readonly repository: ReminderRepository) {}
  list(businessId: string) { return this.repository.list({ businessId }); }
  async markSent(invoice: Pick<Invoice, "id" | "businessId" | "customerName" | "customerEmail">, messagePreview: string, sentAt = new Date().toISOString()) {
    const existing = (await this.repository.list({ businessId: invoice.businessId, invoiceId: invoice.id }))[0];
    const values: Omit<Reminder, "id"> = {
      businessId: invoice.businessId, invoiceId: invoice.id, recipient: invoice.customerEmail || invoice.customerName,
      messagePreview, templateKey: null, channel: "manual", status: "sent", scheduledAt: null, sentAt,
      createdAt: existing?.createdAt ?? sentAt, updatedAt: sentAt,
    };
    if (existing) return this.repository.update({ businessId: invoice.businessId, reminderId: existing.id, changes: values });
    return this.repository.create({ reminder: { ...values, id: makeEntityId("reminder") } });
  }
}
