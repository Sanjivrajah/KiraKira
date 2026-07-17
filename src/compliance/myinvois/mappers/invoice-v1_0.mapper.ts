import {
  calculateDocumentLineTotals,
  compareDecimalValues,
  reconcileCommercialDocumentTotals,
  type Address,
  type AllowanceCharge,
  type Business,
  type CommercialDocument,
  type DocumentLine,
  type DocumentTaxSubtotal,
  type DocumentTaxTotal,
  type MoneyValue,
  type Party,
  type RegistrationIdentifier,
} from "@/domain";
import type {
  MyInvoisUblInvoiceLineV10,
  MyInvoisUblInvoiceV10,
  MyInvoisUblJsonInvoiceV10,
  UblAllowanceCharge,
  UblAmount,
  UblParty,
  UblTaxSubtotal,
  UblTaxTotal,
} from "../ubl";
import {
  MyInvoisMappingError,
  type MyInvoisDocumentMapper,
  type MyInvoisMappingContext,
  type MyInvoisMappingDiagnostic,
} from "./mapper";

const VERSION = "1.0";
const MAPPER_VERSION = "invoice-v1.0.3";
const MALAYSIA_UTC_OFFSET_HOURS = 8;
const DOCUMENT_TYPE_CODES: Readonly<Record<CommercialDocument["documentType"], string>> = Object.freeze({
  invoice: "01",
  credit_note: "02",
  debit_note: "03",
  refund_note: "04",
  self_billed_invoice: "11",
  self_billed_credit_note: "12",
  self_billed_debit_note: "13",
  self_billed_refund_note: "14",
});
const COUNTRY_ALPHA_3: Readonly<Record<string, string>> = Object.freeze({
  MY: "MYS",
  MYS: "MYS",
  SG: "SGP",
  SGP: "SGP",
  GB: "GBR",
  GBR: "GBR",
});
const REGISTRATION_SCHEMES: Readonly<Record<RegistrationIdentifier["scheme"], string | undefined>> = {
  brn: "BRN",
  nric: "NRIC",
  passport: "PASSPORT",
  army_number: "ARMY",
  other: undefined,
};

const element = <Value extends string | number | boolean>(value: Value): Array<{ _: Value }> => [{ _: value }];
const number = (value: string) => Number(value);
const amount = (value: MoneyValue): UblAmount[] => [{ _: number(value.amount), currencyID: value.currency }];

function malaysiaIssueDateTimeToUtc(issueDate: string, issueTime: string) {
  const [year, month, day] = issueDate.split("-").map(Number);
  const [hours, minutes, seconds = 0] = issueTime.split(":").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day, hours - MALAYSIA_UTC_OFFSET_HOURS, minutes, seconds));
  const iso = utc.toISOString();
  return { issueDate: iso.slice(0, 10), issueTime: `${iso.slice(11, 19)}Z` };
}

function diagnostic(code: string, canonicalPath: string, message: string, ublPath = "/Invoice"): MyInvoisMappingDiagnostic {
  return { code, canonicalPath, ublPath, fieldPath: canonicalPath, message, documentVersion: VERSION };
}

function mapAllowanceCharge(adjustment: AllowanceCharge): UblAllowanceCharge {
  return {
    ChargeIndicator: element(adjustment.type === "charge"),
    AllowanceChargeReason: element(adjustment.reason),
    ...(adjustment.percentage ? { MultiplierFactorNumeric: element(number(adjustment.percentage) / 100) } : {}),
    ...(adjustment.baseAmount ? { BaseAmount: amount(adjustment.baseAmount) } : {}),
    Amount: amount(adjustment.amount),
  };
}

function mapTaxSubtotal(subtotal: DocumentTaxSubtotal): UblTaxSubtotal {
  return {
    TaxableAmount: amount(subtotal.taxableAmount),
    TaxAmount: amount(subtotal.taxAmount),
    Percent: element(number(subtotal.taxRate)),
    TaxCategory: [{
      ID: element(subtotal.taxTypeCode),
      ...(subtotal.exemption?.reason ? { TaxExemptionReason: element(subtotal.exemption.reason) } : {}),
      TaxScheme: [{ ID: [{ _: "OTH", schemeID: "UN/ECE 5153", schemeAgencyID: "6" }] }],
    }],
  };
}

function mapTaxTotal(total: DocumentTaxTotal): UblTaxTotal {
  return { TaxAmount: amount(total.taxAmount), TaxSubtotal: total.subtotals.map(mapTaxSubtotal) };
}

function mapAddress(address: Address, path: string): UblParty["PostalAddress"][number] {
  const countryCode = COUNTRY_ALPHA_3[address.countryCode];
  if (!countryCode) {
    throw new MyInvoisMappingError([
      diagnostic("address.country.unsupported", `${path}.countryCode`, "Country code has no UBL alpha-3 mapping."),
    ]);
  }
  return {
    CityName: element(address.city),
    ...(address.postcode ? { PostalZone: element(address.postcode) } : {}),
    CountrySubentityCode: element(address.stateCode ?? "17"),
    AddressLine: address.addressLines.map((line) => ({ Line: element(line) })),
    Country: [{ IdentificationCode: [{ _: countryCode, listID: "ISO3166-1", listAgencyID: "6" }] }],
  };
}

function registrationIdentifier(party: Party, path: string) {
  const registration = party.registrationIdentifiers[0];
  const schemeID = registration ? REGISTRATION_SCHEMES[registration.scheme] : undefined;
  if (!registration || !schemeID) {
    throw new MyInvoisMappingError([
      diagnostic("party.registration.unsupported", `${path}.registrationIdentifiers`, "A supported registration identifier is required.", "/Invoice/AccountingCustomerParty/Party/PartyIdentification"),
    ]);
  }
  return { registration, schemeID };
}

function mapParty(party: Party, path: "supplier" | "buyer" | "shippingRecipient", business?: Business): UblParty {
  if (path === "buyer" && party.kind === "general_public") {
    return {
      PartyIdentification: [
        { ID: [{ _: "EI00000000010", schemeID: "TIN" }] },
        { ID: [{ _: "NA", schemeID: "BRN" }] },
      ],
      PostalAddress: [{
        CityName: element("NA"),
        PostalZone: element("00000"),
        CountrySubentityCode: element("17"),
        AddressLine: [{ Line: element("NA") }],
        Country: [{ IdentificationCode: [{ _: "MYS", listID: "ISO3166-1", listAgencyID: "6" }] }],
      }],
      PartyLegalEntity: [{ RegistrationName: element("General Public") }],
      Contact: [{ Telephone: element("NA") }],
    };
  }
  if (!party.billingAddress) {
    throw new MyInvoisMappingError([
      diagnostic("party.address.missing", `${path}.billingAddress`, "A billing address is required for UBL mapping."),
    ]);
  }
  const tin = party.taxIdentifiers.find((identifier) => identifier.scheme === "tin") ?? business?.compliance.tin;
  if (!tin) {
    throw new MyInvoisMappingError([
      diagnostic("party.tin.missing", `${path}.taxIdentifiers`, "A TIN is required for UBL mapping."),
    ]);
  }
  const { registration, schemeID } = registrationIdentifier(party, path);
  const taxIdentifiers = [
    { value: tin.value, schemeID: "TIN" },
    { value: registration.value, schemeID },
    ...party.taxIdentifiers
      .filter((identifier) => identifier.scheme === "sst" || identifier.scheme === "tourism_tax")
      .map((identifier) => ({
        value: identifier.value,
        schemeID: identifier.scheme === "sst" ? "SST" : "TTX",
      })),
  ];
  const contact = party.phone || party.email
    ? [{
        ...(party.phone ? { Telephone: element(party.phone) } : {}),
        ...(party.email ? { ElectronicMail: element(party.email) } : {}),
      }]
    : undefined;
  return {
    ...(business?.compliance.msicCode ? {
      IndustryClassificationCode: [{
        _: business.compliance.msicCode,
        name: business.compliance.businessActivityDescription ?? "Not specified",
      }],
    } : {}),
    PartyIdentification: taxIdentifiers.map((identifier) => ({
      ID: [{ _: identifier.value, schemeID: identifier.schemeID }],
    })),
    PostalAddress: [mapAddress(party.billingAddress, `${path}.billingAddress`)],
    PartyLegalEntity: [{ RegistrationName: element(party.legalName) }],
    ...(contact ? { Contact: contact } : {}),
  };
}

function mapLine(line: DocumentLine): MyInvoisUblInvoiceLineV10 {
  const adjustments = [...line.allowances, ...line.charges];
  return {
    ID: element(line.id),
    InvoicedQuantity: [{ _: number(line.quantity), unitCode: line.unitCode }],
    LineExtensionAmount: amount(line.totals.taxExclusiveAmount),
    ...(adjustments.length ? { AllowanceCharge: adjustments.map(mapAllowanceCharge) } : {}),
    TaxTotal: [{ TaxAmount: amount(line.totals.taxAmount), TaxSubtotal: [mapTaxSubtotal(line.taxTreatment)] }],
    Item: [{
      CommodityClassification: [{
        ItemClassificationCode: [{ _: line.classificationCode, listID: "CLASS" }],
      }, ...(line.itemMetadata.tariffCode ? [{ ItemClassificationCode: [{ _: line.itemMetadata.tariffCode, listID: "PTC" }] }] : [])],
      Description: element(line.description),
      ...(line.itemMetadata.buyerItemReference ? { BuyersItemIdentification: [{ ID: element(line.itemMetadata.buyerItemReference) }] } : {}),
      ...(line.itemMetadata.sellerItemReference ? { SellersItemIdentification: [{ ID: element(line.itemMetadata.sellerItemReference) }] } : {}),
      ...(line.itemMetadata.countryOfOrigin
        ? { OriginCountry: [{ IdentificationCode: element(COUNTRY_ALPHA_3[line.itemMetadata.countryOfOrigin] ?? line.itemMetadata.countryOfOrigin) }] }
        : {}),
    }],
    Price: [{ PriceAmount: amount(line.unitPrice) }],
  };
}

function collectReconciliationDiagnostics(document: CommercialDocument): MyInvoisMappingDiagnostic[] {
  const diagnostics: MyInvoisMappingDiagnostic[] = [];
  document.lines.forEach((line, index) => {
    const expected = calculateDocumentLineTotals({
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      allowances: line.allowances,
      charges: line.charges,
      taxRate: line.taxTreatment.taxRate,
    });
    for (const field of Object.keys(expected) as Array<keyof typeof expected>) {
      if (expected[field].currency !== line.totals[field].currency
        || compareDecimalValues(expected[field].amount, line.totals[field].amount) !== 0) {
        diagnostics.push(diagnostic(
          "totals.line.mismatch",
          `document.lines[${index}].totals.${field}`,
          "Line total does not reconcile with quantity, price, adjustments and tax rate.",
        ));
      }
    }
    if (compareDecimalValues(line.taxTreatment.taxableAmount.amount, line.totals.taxExclusiveAmount.amount) !== 0) {
      diagnostics.push(diagnostic(
        "totals.line-taxable.mismatch",
        `document.lines[${index}].taxTreatment.taxableAmount`,
        "Line taxable amount does not match its tax-exclusive total.",
      ));
    }
  });
  const reconciliation = reconcileCommercialDocumentTotals(
    document.lines,
    document.allowances,
    document.charges,
    document.taxTotals,
    document.monetaryTotals,
  );
  for (const field of reconciliation.differences) {
    diagnostics.push(diagnostic(
      "totals.document.mismatch",
      `document.monetaryTotals.${field}`,
      "Document total does not reconcile with lines, adjustments, tax, prepayments and rounding.",
    ));
  }
  return diagnostics;
}

export class InvoiceV10Mapper implements MyInvoisDocumentMapper<MyInvoisUblJsonInvoiceV10> {
  readonly version = VERSION;
  readonly mapperVersion = MAPPER_VERSION;
  readonly payloadFormat = "json" as const;

  supports(documentType: CommercialDocument["documentType"]): boolean {
    return ["invoice", "credit_note", "debit_note", "refund_note"].includes(documentType);
  }

  map(document: CommercialDocument, context: MyInvoisMappingContext): MyInvoisUblJsonInvoiceV10 {
    const diagnostics = collectReconciliationDiagnostics(document);
    if (diagnostics.length) throw new MyInvoisMappingError(diagnostics);

    const supplier = mapParty(context.supplier, "supplier", context.business);
    const buyer = mapParty(context.buyer, "buyer");
    const utcIssueDateTime = malaysiaIssueDateTimeToUtc(document.issueDate, document.issueTime);
    const adjustments = [...document.allowances, ...document.charges];
    const supplemental = context.supplementalFields ?? {};
    const supplementalString = (key: string) => {
      const value = supplemental[key];
      return typeof value === "string" && value.trim() ? value.trim() : undefined;
    };
    const billingFrequency = supplementalString("billingFrequency");
    const prepaymentDate = supplementalString("prepaymentDate");
    const prepaymentTime = supplementalString("prepaymentTime");
    const prepaymentReference = supplementalString("prepaymentReference");
    const incoterms = supplementalString("incoterms");
    const certifiedExporter = supplementalString("certifiedExporterAuthorisation");
    const supplementalReferences = [
      [supplementalString("customsFormReference"), "CustomsImportForm", undefined],
      [supplementalString("customsForm2"), "CustomsExportForm", undefined],
      [supplementalString("freeTradeAgreement"), "FreeTradeAgreement", supplementalString("freeTradeAgreement")],
    ] as const;
    const additionalReferences = [
      ...document.references
        .filter((reference) => reference.type !== "original_invoice")
        .map((reference) => ({
          ID: element(reference.externalReference ?? reference.internalDocumentId ?? "NA"),
          DocumentType: element(reference.type === "customs_form" ? "CustomsImportForm" : reference.type),
          ...(reference.description ? { DocumentDescription: element(reference.description) } : {}),
        })),
      ...supplementalReferences.flatMap(([id, type, description]) => id ? [{
        ID: element(id),
        DocumentType: element(type),
        ...(description ? { DocumentDescription: element(description) } : {}),
      }] : []),
    ];
    const invoice: MyInvoisUblInvoiceV10 = {
      ID: element(document.internalDocumentNumber),
      IssueDate: element(utcIssueDateTime.issueDate),
      IssueTime: element(utcIssueDateTime.issueTime),
      InvoiceTypeCode: [{ _: DOCUMENT_TYPE_CODES[document.documentType], listVersionID: "1.0" }],
      DocumentCurrencyCode: element(document.currency),
      ...(document.taxCurrency ? { TaxCurrencyCode: element(document.taxCurrency) } : {}),
      ...(document.notes.length ? { Note: document.notes.map((note) => ({ _: note })) } : {}),
      ...(document.billingPeriod || billingFrequency ? {
        InvoicePeriod: [{
          ...(document.billingPeriod ? {
            StartDate: element(document.billingPeriod.startDate),
            EndDate: element(document.billingPeriod.endDate),
          } : {}),
          ...(billingFrequency ? { Description: element(billingFrequency) } : {}),
        }],
      } : {}),
      ...(document.references.filter((reference) => reference.type === "original_invoice").length ? {
        BillingReference: document.references
          .filter((reference) => reference.type === "original_invoice")
          .map((reference) => ({
            InvoiceDocumentReference: [{
              ...(reference.externalReference || reference.internalDocumentId ? { ID: element(reference.externalReference ?? reference.internalDocumentId!) } : {}),
              ...(reference.myInvoisUuid ? { UUID: element(reference.myInvoisUuid) } : {}),
              ...(reference.issueDate ? { IssueDate: element(reference.issueDate) } : {}),
            }],
          })),
      } : {}),
      ...(additionalReferences.length ? { AdditionalDocumentReference: additionalReferences } : {}),
      AccountingSupplierParty: [{
        ...(certifiedExporter ? { AdditionalAccountID: [{ _: certifiedExporter, schemeAgencyName: "CertEX" }] } : {}),
        Party: [supplier],
      }],
      AccountingCustomerParty: [{ Party: [buyer] }],
      ...(context.shippingRecipient || incoterms ? {
        Delivery: [{
          ...(context.shippingRecipient ? { DeliveryParty: [mapParty(context.shippingRecipient, "shippingRecipient")] } : {}),
          ...(incoterms ? { DeliveryTerms: [{ ID: element(incoterms) }] } : {}),
        }],
      } : {}),
      ...(document.paymentInstructions ? {
        PaymentMeans: [{
          PaymentMeansCode: element(document.paymentInstructions.paymentModeCode),
          ...(document.paymentInstructions.paymentReference
            ? { PaymentID: element(document.paymentInstructions.paymentReference) }
            : {}),
          ...(document.paymentInstructions.dueDate ? { PaymentDueDate: element(document.paymentInstructions.dueDate) } : {}),
          ...(document.paymentInstructions.bankAccountIdentifier
            ? { PayeeFinancialAccount: [{ ID: element(document.paymentInstructions.bankAccountIdentifier) }] }
            : {}),
        }],
        ...(document.paymentInstructions.paymentTerms
          ? { PaymentTerms: [{ Note: element(document.paymentInstructions.paymentTerms) }] }
          : {}),
      } : {}),
      ...(Number(document.monetaryTotals.prepaidAmount.amount) > 0 ? {
        PrepaidPayment: [{
          ...(prepaymentReference ? { ID: element(prepaymentReference) } : {}),
          PaidAmount: amount(document.monetaryTotals.prepaidAmount),
          ...(prepaymentDate ? { PaidDate: element(prepaymentDate) } : {}),
          ...(prepaymentTime ? { PaidTime: element(prepaymentTime) } : {}),
        }],
      } : {}),
      ...(document.taxCurrency && document.exchangeRate ? {
        TaxExchangeRate: [{
          SourceCurrencyCode: element(document.currency),
          TargetCurrencyCode: element(document.taxCurrency),
          CalculationRate: element(number(document.exchangeRate)),
        }],
      } : {}),
      ...(adjustments.length ? { AllowanceCharge: adjustments.map(mapAllowanceCharge) } : {}),
      TaxTotal: document.taxTotals.map(mapTaxTotal),
      LegalMonetaryTotal: [{
        LineExtensionAmount: amount(document.monetaryTotals.lineExtensionAmount),
        TaxExclusiveAmount: amount(document.monetaryTotals.taxExclusiveAmount),
        TaxInclusiveAmount: amount(document.monetaryTotals.taxInclusiveAmount),
        AllowanceTotalAmount: amount(document.monetaryTotals.allowanceTotal),
        ChargeTotalAmount: amount(document.monetaryTotals.chargeTotal),
        PrepaidAmount: amount(document.monetaryTotals.prepaidAmount),
        PayableRoundingAmount: amount(document.monetaryTotals.roundingAmount),
        PayableAmount: amount(document.monetaryTotals.payableAmount),
      }],
      InvoiceLine: document.lines.map(mapLine),
    };
    return {
      _D: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
      _A: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
      _B: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
      Invoice: [invoice],
    };
  }
}

export const invoiceV10Mapper = new InvoiceV10Mapper();
