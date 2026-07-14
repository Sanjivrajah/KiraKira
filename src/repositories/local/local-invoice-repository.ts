import { browserStorage, type KeyValueStorage } from "@/lib/storage/browser-storage";
import { STORAGE_KEYS } from "@/lib/storage/storage-keys";
import type { InvoiceRepository } from "@/repositories/contracts";
import type { Invoice } from "@/types";
import { LocalEntityStore } from "./local-entity-store";
import { parseInvoice } from "./parsers";

export class LocalInvoiceRepository extends LocalEntityStore<Invoice> implements InvoiceRepository {
  constructor(storage: KeyValueStorage = browserStorage) { super(STORAGE_KEYS.invoices, storage, parseInvoice); }
  async list({ businessId }: { businessId: string }) { return this.readAll().filter((item) => item.businessId === businessId); }
  async getById({ businessId, invoiceId }: { businessId: string; invoiceId: string }) { return this.readAll().find((item) => item.businessId === businessId && item.id === invoiceId) ?? null; }
  async create({ invoice }: { invoice: Invoice }) { return this.createEntity(invoice); }
  async update({ businessId, invoiceId, changes }: { businessId: string; invoiceId: string; changes: Partial<Invoice> }) { return this.updateEntity(invoiceId, { ...changes, businessId }, businessId); }
  async remove({ businessId, invoiceId }: { businessId: string; invoiceId: string }) { this.removeEntity(invoiceId, businessId); }
  async initializeDemo({ businessId, fixtures }: { businessId: string; fixtures: Invoice[] }) {
    if (!this.hasStoredValue()) this.writeAll(fixtures);
    return this.list({ businessId });
  }
  async clearForBusiness({ businessId }: { businessId: string }) { this.writeAll(this.readAll().filter((item) => item.businessId !== businessId)); }
  async clear() { this.clearAll(); }
}
