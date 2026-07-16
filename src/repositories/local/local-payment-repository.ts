import { browserStorage, type KeyValueStorage } from "@/lib/storage/browser-storage";
import { STORAGE_KEYS } from "@/lib/storage/storage-keys";
import type { PaymentRepository } from "@/repositories/contracts";
import type { Payment } from "@/types";
import { LocalEntityStore } from "./local-entity-store";
import { parsePayment } from "./parsers";

export class LocalPaymentRepository extends LocalEntityStore<Payment> implements PaymentRepository {
  constructor(storage: KeyValueStorage = browserStorage) { super(STORAGE_KEYS.payments, storage, parsePayment); }
  async list({ businessId, invoiceId }: { businessId: string; invoiceId?: string }) { return this.readAll().filter((item) => item.businessId === businessId && (!invoiceId || item.invoiceId === invoiceId)); }
  async getById({ businessId, paymentId }: { businessId: string; paymentId: string }) { return this.readAll().find((item) => item.businessId === businessId && item.id === paymentId) ?? null; }
  async create({ payment }: { payment: Payment }) { return this.createEntity(payment); }
  async update({ businessId, paymentId, changes }: { businessId: string; paymentId: string; changes: Partial<Payment> }) { return this.updateEntity(paymentId, { ...changes, businessId }, businessId); }
  async remove({ businessId, paymentId }: { businessId: string; paymentId: string }) { this.removeEntity(paymentId, businessId); }
  async clearForBusiness({ businessId }: { businessId: string }) { this.writeAll(this.readAll().filter((item) => item.businessId !== businessId)); }
  async clear() { this.clearAll(); }
}
