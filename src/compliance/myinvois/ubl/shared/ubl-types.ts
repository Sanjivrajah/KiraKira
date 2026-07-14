export interface UblValue<Value = string> {
  _: Value;
}

export type UblElement<Value = string> = UblValue<Value>[];

export interface UblAmount extends UblValue<number> {
  currencyID: string;
}

export interface UblIdentifier extends UblValue<string> {
  schemeID?: string;
  schemeAgencyID?: string;
  listID?: string;
  listAgencyID?: string;
}

export interface UblAllowanceCharge {
  ChargeIndicator: UblElement<boolean>;
  AllowanceChargeReason: UblElement;
  MultiplierFactorNumeric?: UblElement<number>;
  BaseAmount?: UblAmount[];
  Amount: UblAmount[];
}

export interface UblTaxSubtotal {
  TaxableAmount: UblAmount[];
  TaxAmount: UblAmount[];
  Percent: UblElement<number>;
  TaxCategory: Array<{
    ID: UblElement;
    TaxExemptionReason?: UblElement;
    TaxScheme: Array<{ ID: UblIdentifier[] }>;
  }>;
}

export interface UblTaxTotal {
  TaxAmount: UblAmount[];
  TaxSubtotal: UblTaxSubtotal[];
}

export interface UblParty {
  IndustryClassificationCode?: Array<UblValue<string> & { name: string }>;
  PartyIdentification: Array<{ ID: UblIdentifier[] }>;
  PostalAddress: Array<{
    CityName: UblElement;
    PostalZone?: UblElement;
    CountrySubentityCode: UblElement;
    AddressLine: Array<{ Line: UblElement }>;
    Country: Array<{ IdentificationCode: UblIdentifier[] }>;
  }>;
  PartyLegalEntity: Array<{ RegistrationName: UblElement }>;
  Contact?: Array<{ Telephone?: UblElement; ElectronicMail?: UblElement }>;
}
