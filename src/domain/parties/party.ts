import type { Address } from "../addresses";
import type { AuditableEntity, CurrencyCode, PartyId } from "../common";
import type { RegistrationIdentifier, TaxIdentifier } from "./identifiers";

export type PartyKind =
  | "business"
  | "individual"
  | "government_entity"
  | "foreign_entity"
  | "general_public";

export type PartyRole = "buyer" | "seller" | "customer" | "supplier" | "payer" | "payee";

export interface Party extends Omit<AuditableEntity, "id"> {
  id: PartyId;
  kind: PartyKind;
  legalName: string;
  tradingName?: string;
  roles: PartyRole[];
  taxIdentifiers: TaxIdentifier[];
  registrationIdentifiers: RegistrationIdentifier[];
  email?: string;
  phone?: string;
  billingAddress?: Address;
  shippingAddress?: Address;
  defaultCurrency?: CurrencyCode;
  defaultPaymentTermsDays?: number;
}
