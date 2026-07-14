import { browserStorage, type KeyValueStorage } from "@/lib/storage/browser-storage";
import { STORAGE_KEYS } from "@/lib/storage/storage-keys";
import type { BusinessMembershipRepository } from "@/repositories/contracts";
import type { BusinessMember } from "@/types";
import { LocalEntityStore } from "./local-entity-store";
import { parseBusinessMember } from "./parsers";

export class LocalBusinessMembershipRepository extends LocalEntityStore<BusinessMember> implements BusinessMembershipRepository {
  constructor(storage: KeyValueStorage = browserStorage) { super(STORAGE_KEYS.memberships, storage, parseBusinessMember); }
  async listForUser({ userId }: { userId: string }) { return this.readAll().filter((item) => item.userId === userId); }
  async create({ membership }: { membership: BusinessMember }) { return this.createEntity(membership); }
  async clear() { this.clearAll(); }
}
