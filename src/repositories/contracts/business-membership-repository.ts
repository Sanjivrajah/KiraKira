import type { BusinessMember } from "@/types";

export interface BusinessMembershipRepository {
  listForUser(input: { userId: string }): Promise<BusinessMember[]>;
  create(input: { membership: BusinessMember }): Promise<BusinessMember>;
  clear(): Promise<void>;
}
