import type {
  UblAllowanceCharge,
  UblAmount,
  UblElement,
  UblIdentifier,
  UblParty,
  UblTaxTotal,
  UblValue,
} from "../shared/ubl-types";

export interface MyInvoisUblInvoiceLineV11 {
  ID: UblElement;
  InvoicedQuantity: Array<UblValue<number> & { unitCode: string }>;
  LineExtensionAmount: UblAmount[];
  AllowanceCharge?: UblAllowanceCharge[];
  TaxTotal: UblTaxTotal[];
  Item: Array<{
    CommodityClassification: Array<{
      ItemClassificationCode: Array<UblValue<string> & { listID: string }>;
    }>;
    Description: UblElement;
    OriginCountry?: Array<{ IdentificationCode: UblElement }>;
  }>;
  Price: Array<{ PriceAmount: UblAmount[] }>;
}

export interface MyInvoisUblInvoiceV11 {
  ID: UblElement;
  IssueDate: UblElement;
  IssueTime: UblElement;
  InvoiceTypeCode: Array<UblValue<string> & { listVersionID: "1.1" }>;
  DocumentCurrencyCode: UblElement;
  TaxCurrencyCode?: UblElement;
  Note?: UblElement;
  InvoicePeriod?: Array<{ StartDate: UblElement; EndDate: UblElement }>;
  BillingReference?: Array<{
    InvoiceDocumentReference: Array<{ ID?: UblElement; UUID?: UblElement; IssueDate?: UblElement }>;
  }>;
  AccountingSupplierParty: Array<{ Party: UblParty[] }>;
  AccountingCustomerParty: Array<{ Party: UblParty[] }>;
  PaymentMeans?: Array<{
    PaymentMeansCode: UblElement;
    PaymentID?: UblElement;
    PayeeFinancialAccount?: Array<{ ID: UblElement }>;
  }>;
  PaymentTerms?: Array<{ Note: UblElement }>;
  AllowanceCharge?: UblAllowanceCharge[];
  TaxTotal: UblTaxTotal[];
  LegalMonetaryTotal: Array<{
    LineExtensionAmount: UblAmount[];
    TaxExclusiveAmount: UblAmount[];
    TaxInclusiveAmount: UblAmount[];
    AllowanceTotalAmount: UblAmount[];
    ChargeTotalAmount: UblAmount[];
    PrepaidAmount: UblAmount[];
    PayableRoundingAmount: UblAmount[];
    PayableAmount: UblAmount[];
  }>;
  InvoiceLine: MyInvoisUblInvoiceLineV11[];
}

export interface MyInvoisUblJsonInvoiceV11 {
  _D: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2";
  _A: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2";
  _B: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2";
  Invoice: MyInvoisUblInvoiceV11[];
}

export type MyInvoisUblIdentifier = UblIdentifier;

