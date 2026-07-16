import { browserStorage, type KeyValueStorage } from "@/lib/storage/browser-storage";
import { STORAGE_KEYS } from "@/lib/storage/storage-keys";
import type { BusinessRepository } from "@/repositories/contracts";
import type { Business } from "@/types";
import { LocalEntityStore } from "./local-entity-store";
import { parseBusiness } from "./parsers";

export class LocalBusinessRepository extends LocalEntityStore<Business> implements BusinessRepository {
  constructor(storage: KeyValueStorage = browserStorage) { super(STORAGE_KEYS.businesses, storage, parseBusiness); }
  async list() { return this.readAll(); }
  async getById({ businessId }: { businessId: string }) { return this.readAll().find((item) => item.id === businessId) ?? null; }
  async create({ business }: { business: Business }) { return this.createEntity(business); }
  async update({ businessId, changes }: { businessId: string; changes: Partial<Business> }) { return this.updateEntity(businessId, changes); }
  async remove({ businessId }: { businessId: string }) { this.removeEntity(businessId); }
  async clear() { this.clearAll(); }
}
