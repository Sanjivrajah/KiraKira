import { describe, expect, it } from "vitest";
import {
  calculateDocumentMonetaryTotals,
  calculateDocumentLineTotals,
  currencyCodeSchema,
  decimalStringSchema,
  groupDocumentTaxes,
  isoDateSchema,
  partySchema,
  type AllowanceCharge,
  type CommercialDocument,
  type MoneyValue,
} from "@/domain";
import expectedStandardB2b from "./fixtures/expected-ubl/invoice-v1_0-standard-b2b.json";
import {
  UBL_DOCUMENT_DISCOUNT_INVOICE,
  UBL_FIXTURE_BUYER,
  UBL_MAPPABLE_INVOICE_FIXTURES,
  UBL_MULTIPLE_TAX_GROUPS_INVOICE,
  UBL_PENDING_FIXTURES,
  UBL_STANDARD_B2B_INVOICE,
  fixtureMappingContext,
} from "./fixtures";
import {
  MYINVOIS_MAPPER_REGISTRY,
  MyInvoisMapperRegistry,
  MyInvoisMappingError,
  canonicalSerializeMyInvoisPayload,
  hashMyInvoisPayload,
  invoiceV10Mapper,
  type MyInvoisDocumentMapper,
} from "./mappers";
import { createImmutableMyInvoisSnapshot } from "./types";

describe("Invoice v1.0 UBL mapper", () => {
  it("matches the reviewed standard B2B golden file", () => {
    const payload = invoiceV10Mapper.map(UBL_STANDARD_B2B_INVOICE, fixtureMappingContext());
    expect(payload).toEqual(expectedStandardB2b);
  });

  it("converts Malaysia local issuance date and time to UTC", () => {
    const payload = invoiceV10Mapper.map({
      ...UBL_STANDARD_B2B_INVOICE,
      issueDate: "2026-07-17" as CommercialDocument["issueDate"],
      issueTime: "07:30:00" as CommercialDocument["issueTime"],
    }, fixtureMappingContext());

    expect(payload.Invoice[0].IssueDate).toEqual([{ _: "2026-07-16" }]);
    expect(payload.Invoice[0].IssueTime).toEqual([{ _: "23:30:00Z" }]);
  });

  it.each(UBL_MAPPABLE_INVOICE_FIXTURES)("maps the $name fixture", ({ document, buyer }) => {
    const payload = invoiceV10Mapper.map(document, fixtureMappingContext(buyer));
    expect(payload.Invoice).toHaveLength(1);
    expect(payload.Invoice[0].ID[0]._).toBe(document.internalDocumentNumber);
    expect(payload.Invoice[0].InvoiceLine).toHaveLength(document.lines.length);
  });

  it("preserves multiple document tax groups", () => {
    const payload = invoiceV10Mapper.map(UBL_MULTIPLE_TAX_GROUPS_INVOICE, fixtureMappingContext());
    expect(payload.Invoice[0].TaxTotal[0].TaxSubtotal.map((subtotal) => subtotal.TaxCategory[0].ID[0]._))
      .toEqual(["02", "06"]);
  });

  it("maps a document discount as an allowance", () => {
    const invoice = invoiceV10Mapper.map(UBL_DOCUMENT_DISCOUNT_INVOICE, fixtureMappingContext()).Invoice[0];
    expect(invoice.AllowanceCharge).toEqual([expect.objectContaining({
      ChargeIndicator: [{ _: false }],
      MultiplierFactorNumeric: [{ _: 0.1 }],
      Amount: [{ _: 20, currencyID: "MYR" }],
    })]);
    expect(invoice.InvoiceLine[0].ItemPriceExtension).toEqual([{
      Amount: [{ _: 200, currencyID: "MYR" }],
    }]);
    expect(invoice.LegalMonetaryTotal[0].PayableAmount[0]._).toBe(192);
  });

  it("maps a document charge and reconciled payable total", () => {
    const baseAmount = UBL_STANDARD_B2B_INVOICE.monetaryTotals.lineExtensionAmount;
    const charge: AllowanceCharge = {
      type: "charge",
      reason: "Freight",
      percentage: decimalStringSchema.parse("5"),
      baseAmount,
      amount: { ...baseAmount, amount: decimalStringSchema.parse("10") },
    };
    const document: CommercialDocument = {
      ...UBL_STANDARD_B2B_INVOICE,
      charges: [charge],
      monetaryTotals: calculateDocumentMonetaryTotals({
        lines: UBL_STANDARD_B2B_INVOICE.lines,
        charges: [charge],
        taxTotals: UBL_STANDARD_B2B_INVOICE.taxTotals,
      }),
    };
    const invoice = invoiceV10Mapper.map(document, fixtureMappingContext()).Invoice[0];
    expect(invoice.AllowanceCharge).toEqual([expect.objectContaining({ ChargeIndicator: [{ _: true }], Amount: [{ _: 10, currencyID: "MYR" }] })]);
    expect(invoice.LegalMonetaryTotal[0].ChargeTotalAmount[0]._).toBe(10);
  });

  it("maps a foreign-currency invoice through TaxExchangeRate", () => {
    const usdCode = currencyCodeSchema.parse("USD");
    const myrCode = currencyCodeSchema.parse("MYR");
    const usd = (value: MoneyValue): MoneyValue => ({ ...value, currency: usdCode });
    const lines = UBL_STANDARD_B2B_INVOICE.lines.map((line) => ({
      ...line,
      unitPrice: usd(line.unitPrice),
      totals: calculateDocumentLineTotals({ quantity: line.quantity, unitPrice: usd(line.unitPrice), allowances: [], charges: [], taxRate: line.taxTreatment.taxRate }),
    })).map((line) => ({
      ...line,
      taxTreatment: { ...line.taxTreatment, taxableAmount: line.totals.taxExclusiveAmount, taxAmount: line.totals.taxAmount },
    }));
    const taxTotals = groupDocumentTaxes(lines);
    const document: CommercialDocument = {
      ...UBL_STANDARD_B2B_INVOICE,
      currency: usdCode,
      taxCurrency: myrCode,
      exchangeRate: decimalStringSchema.parse("4.5"),
      lines,
      taxTotals,
      monetaryTotals: calculateDocumentMonetaryTotals({ lines, taxTotals }),
    };
    const invoice = invoiceV10Mapper.map(document, fixtureMappingContext()).Invoice[0];
    expect(invoice.TaxExchangeRate).toEqual([{
      SourceCurrencyCode: [{ _: "USD" }],
      TargetCurrencyCode: [{ _: "MYR" }],
      CalculationRate: [{ _: 4.5 }],
    }]);
    expect(JSON.stringify(invoice)).not.toContain("PricingExchangeRate");
  });

  it("maps approved billing, prepayment, shipping, and trade/customs fields without signatures", () => {
    const baseTotals = UBL_STANDARD_B2B_INVOICE.monetaryTotals;
    const document: CommercialDocument = {
      ...UBL_STANDARD_B2B_INVOICE,
      lines: UBL_STANDARD_B2B_INVOICE.lines.map((line) => ({ ...line, itemMetadata: { ...line.itemMetadata, tariffCode: "8517.62" } })),
      billingPeriod: { startDate: isoDateSchema.parse("2026-07-01"), endDate: isoDateSchema.parse("2026-07-31") },
      monetaryTotals: {
        ...baseTotals,
        prepaidAmount: { ...baseTotals.prepaidAmount, amount: decimalStringSchema.parse("20") },
        payableAmount: { ...baseTotals.payableAmount, amount: decimalStringSchema.parse("192") },
      },
    };
    const invoice = invoiceV10Mapper.map(document, {
      ...fixtureMappingContext(),
      shippingRecipient: UBL_FIXTURE_BUYER,
      supplementalFields: {
        billingFrequency: "Monthly",
        prepaymentReference: "DEP-001",
        prepaymentDate: "2026-06-30",
        prepaymentTime: "12:00:00",
        customsFormReference: "K1-001",
        customsForm2: "K2-001",
        incoterms: "FOB",
        freeTradeAgreement: "ATIGA",
        certifiedExporterAuthorisation: "CE-001",
      },
    }).Invoice[0];

    expect(invoice.InvoicePeriod).toEqual([expect.objectContaining({
      StartDate: [{ _: "2026-07-01" }],
      EndDate: [{ _: "2026-07-31" }],
      Description: [{ _: "Monthly" }],
    })]);
    expect(invoice.PrepaidPayment).toEqual([expect.objectContaining({ ID: [{ _: "DEP-001" }], PaidAmount: [{ _: 20, currencyID: "MYR" }] })]);
    expect(invoice.Delivery).toEqual([expect.objectContaining({ DeliveryParty: expect.any(Array), DeliveryTerms: [{ ID: [{ _: "FOB" }] }] })]);
    expect(invoice.AccountingSupplierParty[0].AdditionalAccountID).toEqual([{ _: "CE-001", schemeAgencyName: "CertEX" }]);
    expect(invoice.AdditionalDocumentReference?.map((reference) => reference.DocumentType[0]._))
      .toEqual(["CustomsImportForm", "CustomsExportForm", "FreeTradeAgreement"]);
    expect(invoice.InvoiceLine[0].Item[0].CommodityClassification).toContainEqual({ ItemClassificationCode: [{ _: "8517.62", listID: "PTC" }] });
    expect(invoice.InvoiceLine[0].Item[0].OriginCountry).toEqual([{ IdentificationCode: [{ _: "MYS" }] }]);
    expect(JSON.stringify(invoice)).not.toMatch(/Signature|Certificate|RSA-SHA256/);
  });

  it("maps an adjustment type and its original MyInvois reference", () => {
    const adjustment: CommercialDocument = {
      ...UBL_STANDARD_B2B_INVOICE,
      documentType: "credit_note",
      internalDocumentNumber: "CN-FIXTURE-001",
      references: [{
        type: "original_invoice",
        externalReference: "INV-FIXTURE-001",
        myInvoisUuid: "123e4567-e89b-42d3-a456-426614174000",
        issueDate: "2026-07-15" as CommercialDocument["issueDate"],
      }],
    };
    const invoice = invoiceV10Mapper.map(adjustment, fixtureMappingContext()).Invoice[0];
    expect(invoice.InvoiceTypeCode).toEqual([{ _: "02", listVersionID: "1.0" }]);
    expect(invoice.BillingReference).toEqual([{
      InvoiceDocumentReference: [{
        ID: [{ _: "INV-FIXTURE-001" }],
        UUID: [{ _: "123e4567-e89b-42d3-a456-426614174000" }],
        IssueDate: [{ _: "2026-07-15" }],
      }],
    }]);
  });

  it("maps the enabled consolidated general-public identity without empty placeholders", () => {
    const generalPublic = partySchema.parse({
      id: "party_general_public",
      kind: "general_public",
      legalName: "General Public",
      roles: ["buyer"],
      taxIdentifiers: [],
      registrationIdentifiers: [],
      createdAt: "2026-07-15T00:00:00.000Z",
      updatedAt: "2026-07-15T00:00:00.000Z",
    });
    const payload = invoiceV10Mapper.map(
      { ...UBL_STANDARD_B2B_INVOICE, buyerPartyId: generalPublic.id },
      fixtureMappingContext(generalPublic),
    );
    const buyer = payload.Invoice[0].AccountingCustomerParty[0].Party[0];
    expect(buyer.PartyIdentification).toEqual([
      { ID: [{ _: "EI00000000010", schemeID: "TIN" }] },
      { ID: [{ _: "NA", schemeID: "BRN" }] },
    ]);
    expect(JSON.stringify(payload)).not.toContain('"":');
  });

  it("throws structured diagnostics for missing required party data", () => {
    const buyer = { ...UBL_FIXTURE_BUYER, billingAddress: undefined };
    expect(() => invoiceV10Mapper.map(UBL_STANDARD_B2B_INVOICE, fixtureMappingContext(buyer)))
      .toThrow(MyInvoisMappingError);
    try {
      invoiceV10Mapper.map(UBL_STANDARD_B2B_INVOICE, fixtureMappingContext(buyer));
    } catch (error) {
      expect(error).toBeInstanceOf(MyInvoisMappingError);
      expect((error as MyInvoisMappingError).diagnostics).toContainEqual(expect.objectContaining({
        code: "party.address.missing",
        fieldPath: "buyer.billingAddress",
        message: "A billing address is required for UBL mapping.",
        documentVersion: "1.0",
        canonicalPath: "buyer.billingAddress",
        ublPath: "/Invoice",
      }));
    }
  });

  it("never emits a Malaysian state name as CountrySubentityCode", () => {
    const buyer = {
      ...UBL_FIXTURE_BUYER,
      billingAddress: { ...UBL_FIXTURE_BUYER.billingAddress!, stateCode: "Selangor" },
    };
    expect(() => invoiceV10Mapper.map(UBL_STANDARD_B2B_INVOICE, fixtureMappingContext(buyer)))
      .toThrowError(expect.objectContaining({
        diagnostics: expect.arrayContaining([expect.objectContaining({
          code: "address.state.invalid",
          fieldPath: "buyer.billingAddress.stateCode",
        })]),
      }));
  });

  it("rejects unreconciled line totals with an exact field path", () => {
    const line = UBL_STANDARD_B2B_INVOICE.lines[0];
    const document: CommercialDocument = {
      ...UBL_STANDARD_B2B_INVOICE,
      lines: [{
        ...line,
        totals: {
          ...line.totals,
          taxAmount: { ...line.totals.taxAmount, amount: decimalStringSchema.parse("99") },
        },
      }],
    };
    expect(() => invoiceV10Mapper.map(document, fixtureMappingContext())).toThrowError(
      expect.objectContaining({
        diagnostics: expect.arrayContaining([expect.objectContaining({
          code: "totals.line.mismatch",
          fieldPath: "document.lines[0].totals.taxAmount",
        })]),
      }),
    );
  });

  it("rejects unreconciled payable totals before mapping", () => {
    const document: CommercialDocument = {
      ...UBL_STANDARD_B2B_INVOICE,
      monetaryTotals: {
        ...UBL_STANDARD_B2B_INVOICE.monetaryTotals,
        payableAmount: {
          ...UBL_STANDARD_B2B_INVOICE.monetaryTotals.payableAmount,
          amount: decimalStringSchema.parse("999"),
        },
      },
    };
    expect(() => invoiceV10Mapper.map(document, fixtureMappingContext())).toThrowError(
      expect.objectContaining({
        diagnostics: expect.arrayContaining([expect.objectContaining({
          code: "totals.document.mismatch",
          fieldPath: "document.monetaryTotals.payableAmount",
        })]),
      }),
    );
  });
});

describe("mapper registry and version isolation", () => {
  it("selects Invoice v1.0 by document type and format", () => {
    expect(MYINVOIS_MAPPER_REGISTRY.resolve({
      version: "1.0",
      documentType: "invoice",
      payloadFormat: "json",
    })).toBe(invoiceV10Mapper);
    expect((invoiceV10Mapper.map(UBL_STANDARD_B2B_INVOICE, fixtureMappingContext()) as { Invoice: Array<{ InvoiceTypeCode: Array<{ listVersionID: string }> }> })
      .Invoice[0].InvoiceTypeCode[0].listVersionID).toBe("1.0");
  });

  it.each([
    { version: "2.0", documentType: "invoice" as const, payloadFormat: "json" as const },
    { version: "1.1", documentType: "invoice" as const, payloadFormat: "xml" as const },
    { version: "1.1", documentType: "self_billed_invoice" as const, payloadFormat: "json" as const },
    { version: "1.1", documentType: "invoice" as const, payloadFormat: "json" as const },
  ])("rejects unsupported $version $documentType $payloadFormat mappings", (selection) => {
    expect(() => MYINVOIS_MAPPER_REGISTRY.resolve(selection)).toThrowError(
      expect.objectContaining({
        diagnostics: [expect.objectContaining({ code: "mapper.unsupported", documentVersion: selection.version })],
      }),
    );
  });

  it("uses the Invoice v1.0 UBL structure for adjustment documents", () => {
    expect(MYINVOIS_MAPPER_REGISTRY.resolve({
      version: "1.0",
      documentType: "credit_note",
      payloadFormat: "json",
    })).toBe(invoiceV10Mapper);
  });

  it("rejects historical v1.1 even if a caller constructs that selection", () => {
    const mapper = (version: string, marker: string): MyInvoisDocumentMapper<{ marker: string }> => ({
      version,
      mapperVersion: `fixture-${version}`,
      payloadFormat: "json",
      supports: (type) => type === "invoice",
      map: () => ({ marker }),
    });
    const v10 = mapper("1.0", "v1.0");
    const registry = new MyInvoisMapperRegistry([v10]);
    expect(registry.resolve({ version: "1.0", documentType: "invoice", payloadFormat: "json" }).map(
      UBL_STANDARD_B2B_INVOICE,
      fixtureMappingContext(),
    )).toEqual({ marker: "v1.0" });
    expect(() => registry.resolve({ version: "1.1", documentType: "invoice", payloadFormat: "json" }))
      .toThrow(MyInvoisMappingError);
  });

  it("tracks deferred document fixtures explicitly", () => {
    expect(UBL_PENDING_FIXTURES.map((fixture) => fixture.name)).toEqual([
      "self-billed invoice",
    ]);
  });
});

describe("canonical UBL serialization and hashing", () => {
  it("canonicalizes object keys while preserving array order", () => {
    expect(canonicalSerializeMyInvoisPayload({ z: 1, nested: { b: 2, a: 1 }, array: [2, 1] }))
      .toBe('{"array":[2,1],"nested":{"a":1,"b":2},"z":1}');
  });

  it("produces a deterministic SHA-256 hash and immutable snapshot", () => {
    const firstPayload = invoiceV10Mapper.map(UBL_STANDARD_B2B_INVOICE, fixtureMappingContext());
    const secondPayload = invoiceV10Mapper.map(UBL_STANDARD_B2B_INVOICE, fixtureMappingContext());
    const firstHash = hashMyInvoisPayload(firstPayload);
    expect(firstHash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashMyInvoisPayload(secondPayload)).toBe(firstHash);
    const snapshot = createImmutableMyInvoisSnapshot({
      id: "snapshot_fixture_invoice_b2b",
      commercialDocumentId: UBL_STANDARD_B2B_INVOICE.id,
      documentTypeCode: "01",
      documentVersion: invoiceV10Mapper.version,
      format: invoiceV10Mapper.payloadFormat,
      unsignedPayload: firstPayload,
      payloadHash: firstHash,
      generatedAt: "2026-07-15T00:00:00.000Z",
      mapperVersion: invoiceV10Mapper.mapperVersion,
    });
    expect(snapshot.payloadHash).toBe(firstHash);
    expect(Object.isFrozen(snapshot.unsignedPayload)).toBe(true);
  });
});
