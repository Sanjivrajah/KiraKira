import type { BusinessId, Party, PartyId } from "@/domain";
import type { BusinessScopedRepository } from "../shared/repository";

export interface PartyRepository extends BusinessScopedRepository<Party, PartyId> {
  findByTin(businessId: BusinessId, tin: string): Promise<readonly Party[]>;
  findByRegistration(businessId: BusinessId, value: string): Promise<readonly Party[]>;
}
