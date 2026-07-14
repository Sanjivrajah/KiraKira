export type BusinessType =
  | "food_beverage"
  | "retail"
  | "services"
  | "online_seller"
  | "other";

export type PreferredLanguage = "en" | "ms";

export interface BusinessInput {
  name: string;
  type: BusinessType;
  registrationNumber: string;
  tin: string;
  currency: CurrencyCode;
  preferredLanguage: PreferredLanguage;
}

export interface Business extends AuditableEntity {
  name: string;
  type: BusinessType;
  registrationNumber: string | null;
  tin: string | null;
  currency: CurrencyCode;
  preferredLanguage: PreferredLanguage;
}

export type BusinessRole = "owner" | "admin" | "member";

export interface BusinessMember extends AuditableEntity {
  businessId: EntityId;
  userId: EntityId;
  role: BusinessRole;
}
import type { AuditableEntity, CurrencyCode, EntityId } from "./common";
