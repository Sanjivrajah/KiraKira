import type { BusinessId } from "@/domain";

export interface RepositoryWriteOptions {
  idempotencyKey?: string;
  expectedVersion?: number;
}

export interface BusinessScopedRepository<Entity, Identifier extends string> {
  getById(businessId: BusinessId, id: Identifier): Promise<Entity | null>;
  list(businessId: BusinessId): Promise<readonly Entity[]>;
  save(businessId: BusinessId, entity: Entity, options?: RepositoryWriteOptions): Promise<Entity>;
  findByIdempotencyKey(businessId: BusinessId, idempotencyKey: string): Promise<Entity | null>;
}

export class ApplicationError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "ApplicationError";
  }
}

