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
  MyInvoisUblInvoiceLineV11,
  MyInvoisUblInvoiceV11,
  MyInvoisUblJsonInvoiceV11,
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

const VERSION = "1.1";
const MAPPER_VERSION = "invoice-v1.1.0";
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

function diagnostic(code: string, fieldPath: string, message: string): MyInvoisMappingDiagnostic {
  return { code, fieldPath, message, documentVersion: VERSION };
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
      diagnostic("party.registration.unsupported", `${path}.registrationIdentifiers`, "A supported registration identifier is required."),
    ]);
  }
  return { registration, schemeID };
}

function mapParty(party: Party, path: "supplier" | "buyer", business?: Business): UblParty {
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

function mapLine(line: DocumentLine): MyInvoisUblInvoiceLineV11 {
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
      }],
      Description: element(line.description),
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

export class InvoiceV11Mapper implements MyInvoisDocumentMapper<MyInvoisUblJsonInvoiceV11> {
  readonly version = VERSION;
  readonly mapperVersion = MAPPER_VERSION;
  readonly payloadFormat = "json" as const;

  supports(documentType: CommercialDocument["documentType"]): boolean {
    return documentType === "invoice";
  }

  map(document: CommercialDocument, context: MyInvoisMappingContext): MyInvoisUblJsonInvoiceV11 {
    const diagnostics = collectReconciliationDiagnostics(document);
    if (diagnostics.length) throw new MyInvoisMappingError(diagnostics);

    const supplier = mapParty(context.supplier, "supplier", context.business);
    const buyer = mapParty(context.buyer, "buyer");
    const adjustments = [...document.allowances, ...document.charges];
    const invoice: MyInvoisUblInvoiceV11 = {
      ID: element(document.internalDocumentNumber),
      IssueDate: element(document.issueDate),
      IssueTime: element(document.issueTime),
      InvoiceTypeCode: [{ _: "01", listVersionID: "1.1" }],
      DocumentCurrencyCode: element(document.currency),
      ...(document.taxCurrency ? { TaxCurrencyCode: element(document.taxCurrency) } : {}),
      ...(document.notes.length ? { Note: document.notes.map((note) => ({ _: note })) } : {}),
      ...(document.billingPeriod ? {
        InvoicePeriod: [{
          StartDate: element(document.billingPeriod.startDate),
          EndDate: element(document.billingPeriod.endDate),
        }],
      } : {}),
      AccountingSupplierParty: [{ Party: [supplier] }],
      AccountingCustomerParty: [{ Party: [buyer] }],
      ...(document.paymentInstructions ? {
        PaymentMeans: [{
          PaymentMeansCode: element(document.paymentInstructions.paymentModeCode),
          ...(document.paymentInstructions.paymentReference
            ? { PaymentID: element(document.paymentInstructions.paymentReference) }
            : {}),
          ...(document.paymentInstructions.bankAccountIdentifier
            ? { PayeeFinancialAccount: [{ ID: element(document.paymentInstructions.bankAccountIdentifier) }] }
            : {}),
        }],
        ...(document.paymentInstructions.paymentTerms
          ? { PaymentTerms: [{ Note: element(document.paymentInstructions.paymentTerms) }] }
          : {}),
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

export const invoiceV11Mapper = new InvoiceV11Mapper();
