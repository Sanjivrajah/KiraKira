import type { Address } from "../addresses";
import type { AuditableEntity, BusinessId, CurrencyCode } from "../common";
import type { BusinessComplianceProfile } from "./compliance-profile";

export type BusinessEntityType =
  | "sole_proprietorship"
  | "partnership"
  | "limited_liability_partnership"
  | "private_limited_company"
  | "public_limited_company"
  | "association"
  | "government_entity"
  | "individual"
  | "foreign_entity"
  | "other";

export type PreferredLanguage = "en" | "ms";

export interface BusinessContactDetails {
  email?: string;
  phone?: string;
}

export interface Business extends Omit<AuditableEntity, "id"> {
  id: BusinessId;
  legalName: string;
  tradingName?: string;
  entityType: BusinessEntityType;
  compliance: BusinessComplianceProfile;
  contact: BusinessContactDetails;
  address: Address;
  defaultCurrency: CurrencyCode;
  preferredLanguage: PreferredLanguage;
  timezone: string;
}
