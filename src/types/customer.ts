import type { AuditableEntity, EntityId } from "./common";

export interface Customer extends AuditableEntity {
  businessId: EntityId;
  name: string;
  email?: string | null;
  phone?: string | null;
  tin?: string | null;
  registrationNumber?: string | null;
  address?: string | null;
}

export type CounterpartyType = "customer" | "supplier" | "other";

export interface Counterparty extends AuditableEntity {
  businessId: EntityId;
  type: CounterpartyType;
  name: string;
  email?: string | null;
  phone?: string | null;
  tin?: string | null;
}
