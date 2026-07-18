import type {
  UblAllowanceCharge,
  UblAmount,
  UblElement,
  UblIdentifier,
  UblParty,
  UblTaxTotal,
  UblValue,
} from "../shared/ubl-types";

export interface MyInvoisUblInvoiceLineV10 {
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
    BuyersItemIdentification?: Array<{ ID: UblElement }>;
    SellersItemIdentification?: Array<{ ID: UblElement }>;
    OriginCountry?: Array<{ IdentificationCode: UblElement }>;
  }>;
  Price: Array<{ PriceAmount: UblAmount[] }>;
  ItemPriceExtension: Array<{ Amount: UblAmount[] }>;
}

export interface MyInvoisUblInvoiceV10 {
  ID: UblElement;
  IssueDate: UblElement;
  IssueTime: UblElement;
  InvoiceTypeCode: Array<UblValue<string> & { listVersionID: "1.0" }>;
  DocumentCurrencyCode: UblElement;
  TaxCurrencyCode?: UblElement;
  Note?: UblElement;
  InvoicePeriod?: Array<{ StartDate?: UblElement; EndDate?: UblElement; Description?: UblElement }>;
  BillingReference?: Array<{
    InvoiceDocumentReference: Array<{ ID?: UblElement; UUID?: UblElement; IssueDate?: UblElement }>;
  }>;
  AdditionalDocumentReference?: Array<{
    ID: UblElement;
    DocumentType: UblElement;
    DocumentDescription?: UblElement;
  }>;
  AccountingSupplierParty: Array<{ AdditionalAccountID?: Array<UblValue<string> & { schemeAgencyName: string }>; Party: UblParty[] }>;
  AccountingCustomerParty: Array<{ Party: UblParty[] }>;
  Delivery?: Array<{
    DeliveryParty?: UblParty[];
    DeliveryTerms?: Array<{ ID: UblElement }>;
  }>;
  PaymentMeans?: Array<{
    PaymentMeansCode: UblElement;
    PaymentID?: UblElement;
    PaymentDueDate?: UblElement;
    PayeeFinancialAccount?: Array<{ ID: UblElement }>;
  }>;
  PaymentTerms?: Array<{ Note: UblElement }>;
  PrepaidPayment?: Array<{
    ID?: UblElement;
    PaidAmount: UblAmount[];
    PaidDate?: UblElement;
    PaidTime?: UblElement;
  }>;
  TaxExchangeRate?: Array<{
    SourceCurrencyCode: UblElement;
    TargetCurrencyCode: UblElement;
    CalculationRate: Array<UblValue<number>>;
  }>;
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
  InvoiceLine: MyInvoisUblInvoiceLineV10[];
}

export interface MyInvoisUblJsonInvoiceV10 {
  _D: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2";
  _A: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2";
  _B: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2";
  Invoice: MyInvoisUblInvoiceV10[];
}

export type MyInvoisUblIdentifier = UblIdentifier;
