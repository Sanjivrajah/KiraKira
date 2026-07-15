import type { PartyId } from "../common";
import type { Party, PartyKind } from "../parties";
import type { Business, BusinessEntityType } from "./business";

const ENTITY_TYPE_TO_PARTY_KIND: Readonly<Record<BusinessEntityType, PartyKind>> = {
  sole_proprietorship: "individual",
  partnership: "business",
  limited_liability_partnership: "business",
  private_limited_company: "business",
  public_limited_company: "business",
  association: "business",
  government_entity: "government_entity",
  individual: "individual",
  foreign_entity: "foreign_entity",
  other: "business",
};

/** Map a granular entity type to the coarser party kind used on invoices. */
export function mapEntityTypeToPartyKind(entityType: BusinessEntityType): PartyKind {
  return ENTITY_TYPE_TO_PARTY_KIND[entityType];
}

/**
 * Projects a Business entity into a Party record suitable for use as
 * an e-invoice supplier. Combines identity from compliance, contact
 * details, and address into a single Party shape.
 *
 * The returned Party is a snapshot — callers should persist or freeze
 * it at invoice-generation time.
 */
export function projectBusinessAsSupplierParty(
  business: Business,
  partyId?: PartyId,
): Party {
  return {
    id: partyId ?? (business.id as unknown as PartyId),
    kind: mapEntityTypeToPartyKind(business.entityType),
    legalName: business.legalName,
    tradingName: business.tradingName,
    roles: ["supplier", "seller"],
    taxIdentifiers: [
      ...(business.compliance.tin ? [business.compliance.tin] : []),
      ...business.compliance.sstRegistrations,
      ...(business.compliance.tourismTaxRegistration
        ? [business.compliance.tourismTaxRegistration]
        : []),
    ],
    registrationIdentifiers: business.compliance.registration
      ? [business.compliance.registration]
      : [],
    email: business.contact.email,
    phone: business.contact.phone,
    billingAddress: business.address,
    defaultCurrency: business.defaultCurrency,
    createdAt: business.createdAt,
    updatedAt: business.updatedAt,
    createdBy: business.createdBy,
    updatedBy: business.updatedBy,
    version: business.version,
  };
}
