import type { AuditableEntity, EntityId, ISODateTimeString } from "./common";

export type ReminderChannel = "email" | "sms" | "whatsapp" | "manual";
export type ReminderStatus = "scheduled" | "sent" | "failed" | "cancelled";

export interface Reminder extends AuditableEntity {
  businessId: EntityId;
  invoiceId: EntityId;
  recipient: string;
  messagePreview?: string | null;
  templateKey?: string | null;
  channel: ReminderChannel;
  status: ReminderStatus;
  scheduledAt?: ISODateTimeString | null;
  sentAt?: ISODateTimeString | null;
}
