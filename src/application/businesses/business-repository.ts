import type { Business, BusinessId } from "@/domain";
import type { RepositoryWriteOptions } from "../shared/repository";

export interface BusinessRepository {
  getById(id: BusinessId): Promise<Business | null>;
  save(business: Business, options?: RepositoryWriteOptions): Promise<Business>;
}

