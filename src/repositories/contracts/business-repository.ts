import type { Business } from "@/types";

export interface BusinessRepository {
  list(): Promise<Business[]>;
  getById(input: { businessId: string }): Promise<Business | null>;
  create(input: { business: Business }): Promise<Business>;
  update(input: { businessId: string; changes: Partial<Business> }): Promise<Business>;
  remove(input: { businessId: string }): Promise<void>;
  clear(): Promise<void>;
}
