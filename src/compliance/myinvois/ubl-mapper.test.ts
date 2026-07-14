import { describe, expect, it } from "vitest";
import { decimalStringSchema, type CommercialDocument } from "@/domain";
import expectedStandardB2b from "./fixtures/expected-ubl/invoice-v1_1-standard-b2b.json";
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
  invoiceV11Mapper,
  type MyInvoisDocumentMapper,
} from "./mappers";
import { createImmutableMyInvoisSnapshot } from "./types";

describe("Invoice v1.1 UBL mapper", () => {
  it("matches the reviewed standard B2B golden file", () => {
    const payload = invoiceV11Mapper.map(UBL_STANDARD_B2B_INVOICE, fixtureMappingContext());
    expect(payload).toEqual(expectedStandardB2b);
  });

  it.each(UBL_MAPPABLE_INVOICE_FIXTURES)("maps the $name fixture", ({ document, buyer }) => {
    const payload = invoiceV11Mapper.map(document, fixtureMappingContext(buyer));
    expect(payload.Invoice).toHaveLength(1);
    expect(payload.Invoice[0].ID[0]._).toBe(document.internalDocumentNumber);
    expect(payload.Invoice[0].InvoiceLine).toHaveLength(document.lines.length);
  });

  it("preserves multiple document tax groups", () => {
    const payload = invoiceV11Mapper.map(UBL_MULTIPLE_TAX_GROUPS_INVOICE, fixtureMappingContext());
    expect(payload.Invoice[0].TaxTotal[0].TaxSubtotal.map((subtotal) => subtotal.TaxCategory[0].ID[0]._))
      .toEqual(["02", "06"]);
  });

  it("maps a document discount as an allowance", () => {
    const invoice = invoiceV11Mapper.map(UBL_DOCUMENT_DISCOUNT_INVOICE, fixtureMappingContext()).Invoice[0];
    expect(invoice.AllowanceCharge).toEqual([expect.objectContaining({
      ChargeIndicator: [{ _: false }],
      MultiplierFactorNumeric: [{ _: 0.1 }],
      Amount: [{ _: 20, currencyID: "MYR" }],
    })]);
    expect(invoice.LegalMonetaryTotal[0].PayableAmount[0]._).toBe(192);
  });

  it("throws structured diagnostics for missing required party data", () => {
    const buyer = { ...UBL_FIXTURE_BUYER, billingAddress: undefined };
    expect(() => invoiceV11Mapper.map(UBL_STANDARD_B2B_INVOICE, fixtureMappingContext(buyer)))
      .toThrow(MyInvoisMappingError);
    try {
      invoiceV11Mapper.map(UBL_STANDARD_B2B_INVOICE, fixtureMappingContext(buyer));
    } catch (error) {
      expect(error).toBeInstanceOf(MyInvoisMappingError);
      expect((error as MyInvoisMappingError).diagnostics).toContainEqual({
        code: "party.address.missing",
        fieldPath: "buyer.billingAddress",
        message: "A billing address is required for UBL mapping.",
        documentVersion: "1.1",
      });
    }
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
    expect(() => invoiceV11Mapper.map(document, fixtureMappingContext())).toThrowError(
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
    expect(() => invoiceV11Mapper.map(document, fixtureMappingContext())).toThrowError(
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
  it("selects by version, document type and format", () => {
    expect(MYINVOIS_MAPPER_REGISTRY.resolve({
      version: "1.1",
      documentType: "invoice",
      payloadFormat: "json",
    })).toBe(invoiceV11Mapper);
  });

  it.each([
    { version: "1.0", documentType: "invoice" as const, payloadFormat: "json" as const },
    { version: "1.1", documentType: "invoice" as const, payloadFormat: "xml" as const },
    { version: "1.1", documentType: "self_billed_invoice" as const, payloadFormat: "json" as const },
    { version: "1.1", documentType: "credit_note" as const, payloadFormat: "json" as const },
  ])("rejects unsupported $version $documentType $payloadFormat mappings", (selection) => {
    expect(() => MYINVOIS_MAPPER_REGISTRY.resolve(selection)).toThrowError(
      expect.objectContaining({
        diagnostics: [expect.objectContaining({ code: "mapper.unsupported", documentVersion: selection.version })],
      }),
    );
  });

  it("keeps mapper versions isolated", () => {
    const mapper = (version: string, marker: string): MyInvoisDocumentMapper<{ marker: string }> => ({
      version,
      mapperVersion: `fixture-${version}`,
      payloadFormat: "json",
      supports: (type) => type === "invoice",
      map: () => ({ marker }),
    });
    const v10 = mapper("1.0", "v1.0");
    const v11 = mapper("1.1", "v1.1");
    const registry = new MyInvoisMapperRegistry([v10, v11]);
    expect(registry.resolve({ version: "1.0", documentType: "invoice", payloadFormat: "json" }).map(
      UBL_STANDARD_B2B_INVOICE,
      fixtureMappingContext(),
    )).toEqual({ marker: "v1.0" });
    expect(registry.resolve({ version: "1.1", documentType: "invoice", payloadFormat: "json" }).map(
      UBL_STANDARD_B2B_INVOICE,
      fixtureMappingContext(),
    )).toEqual({ marker: "v1.1" });
  });

  it("tracks deferred document fixtures explicitly", () => {
    expect(UBL_PENDING_FIXTURES.map((fixture) => fixture.name)).toEqual([
      "self-billed invoice",
      "credit note referencing an invoice",
    ]);
  });
});

describe("canonical UBL serialization and hashing", () => {
  it("canonicalizes object keys while preserving array order", () => {
    expect(canonicalSerializeMyInvoisPayload({ z: 1, nested: { b: 2, a: 1 }, array: [2, 1] }))
      .toBe('{"array":[2,1],"nested":{"a":1,"b":2},"z":1}');
  });

  it("produces a deterministic SHA-256 hash and immutable snapshot", () => {
    const firstPayload = invoiceV11Mapper.map(UBL_STANDARD_B2B_INVOICE, fixtureMappingContext());
    const secondPayload = invoiceV11Mapper.map(UBL_STANDARD_B2B_INVOICE, fixtureMappingContext());
    const firstHash = hashMyInvoisPayload(firstPayload);
    expect(firstHash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashMyInvoisPayload(secondPayload)).toBe(firstHash);
    const snapshot = createImmutableMyInvoisSnapshot({
      id: "snapshot_fixture_invoice_b2b",
      commercialDocumentId: UBL_STANDARD_B2B_INVOICE.id,
      documentTypeCode: "01",
      documentVersion: invoiceV11Mapper.version,
      format: invoiceV11Mapper.payloadFormat,
      unsignedPayload: firstPayload,
      payloadHash: firstHash,
      generatedAt: "2026-07-15T00:00:00.000Z",
      mapperVersion: invoiceV11Mapper.mapperVersion,
    });
    expect(snapshot.payloadHash).toBe(firstHash);
    expect(Object.isFrozen(snapshot.unsignedPayload)).toBe(true);
  });
});

