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
  legalName?: string;
  tradingName?: string;
  entityType?: string;
  registrationScheme?: string;
  sstRegistration?: string;
  msicCode?: string;
  businessActivityDescription?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postcode?: string;
  stateCode?: string;
  countryCode?: string;
  email?: string;
  phone?: string;
}

export interface Business extends AuditableEntity {
  name: string;
  type: BusinessType;
  registrationNumber: string | null;
  tin: string | null;
  currency: CurrencyCode;
  preferredLanguage: PreferredLanguage;
  legalName?: string;
  tradingName?: string;
  entityType?: string;
  registrationScheme?: string;
  sstRegistration?: string;
  msicCode?: string;
  businessActivityDescription?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postcode?: string;
  stateCode?: string;
  countryCode?: string;
  email?: string;
  phone?: string;
}

export type BusinessRole = "owner" | "admin" | "member";

export interface BusinessMember extends AuditableEntity {
  businessId: EntityId;
  userId: EntityId;
  role: BusinessRole;
}
import type { AuditableEntity, CurrencyCode, EntityId } from "./common";
