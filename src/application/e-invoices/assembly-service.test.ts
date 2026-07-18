import { describe, expect, it, vi } from "vitest";
import type { EInvoiceAssemblyBundle, EInvoicePreparationRepository, EInvoiceSourceRepository } from "./contracts";
import { AssembleEInvoiceDocumentService } from "./assembly-service";

const ids = {
  business: "11111111-1111-4111-8111-111111111111",
  invoice: "22222222-2222-4222-8222-222222222222",
  buyer: "33333333-3333-4333-8333-333333333333",
  line: "44444444-4444-4444-8444-444444444444",
};

function completeBundle(): EInvoiceAssemblyBundle {
  const timestamp = "2026-07-17T09:00:00.000Z";
  return {
    business: {
      id: ids.business, legalName: "Niaga Satu Sdn Bhd", entityType: "private_limited_company",
      defaultCurrency: "MYR", preferredLanguage: "en", timezone: "Asia/Kuala_Lumpur",
      msicCode: "56101", businessActivityDescription: "Food and beverage services",
      taxIdentifiers: [{ scheme: "tin", value: "C12345678900", issuingCountryCode: "MY" }],
      registrationIdentifiers: [{ scheme: "brn", value: "202601012345", issuingCountryCode: "MY" }],
      email: "billing@example.test", phone: "+60123456789",
      address: { addressLines: ["1 Jalan Niaga"], city: "Kuala Lumpur", postcode: "50000", stateCode: "14", countryCode: "MY" },
      createdAt: timestamp, updatedAt: timestamp, version: 2,
    },
    buyer: {
      id: ids.buyer, kind: "business", legalName: "Buyer Sdn Bhd", roles: ["buyer", "customer"],
      taxIdentifiers: [{ scheme: "tin", value: "C00987654321", issuingCountryCode: "MY" }],
      registrationIdentifiers: [{ scheme: "brn", value: "202501019999", issuingCountryCode: "MY" }],
      email: "buyer@example.test", phone: "+60198765432",
      billingAddress: { addressLines: ["2 Jalan Pembeli"], city: "Shah Alam", postcode: "40000", stateCode: "10", countryCode: "MY" },
      createdAt: timestamp, updatedAt: timestamp, version: 1,
    },
    invoice: {
      id: ids.invoice, businessId: ids.business, documentType: "invoice", invoiceNumber: "INV-2026-1001",
      customerId: ids.buyer, issueDate: "2026-07-17", issueTime: "09:00:00", dueDate: "2026-08-16",
      currency: "MYR", paymentModeCode: "03", bankAccountIdentifier: "1234567890",
      paymentTerms: "30 days", paymentReference: "INV-2026-1001", documentReferences: [],
      documentAllowances: [], documentCharges: [], prepaidMinor: 0, roundingMinor: 0,
      supplementalFields: {}, status: "paid", version: 4, createdAt: timestamp, updatedAt: timestamp,
      items: [{
        id: ids.line, lineNumber: 1, description: "Catering service", quantity: "1", unitCode: "EA",
        unitPriceMinor: 10000, discountMinor: 0, chargeMinor: 0, taxTypeCode: "01", taxRate: "6",
        classificationCode: "022", itemMetadata: {},
      }],
    },
  };
}

function source(bundle: EInvoiceAssemblyBundle): EInvoiceSourceRepository {
  return { loadAssemblyBundle: vi.fn(async (businessId, invoiceId) => businessId === bundle.business.id && invoiceId === bundle.invoice.id ? bundle : null) };
}

describe("AssembleEInvoiceDocumentService", () => {
  it("round-trips a complete B2B source into a schema-valid document and full immutable-source snapshots", async () => {
    const bundle = completeBundle();
    const result = await new AssembleEInvoiceDocumentService(source(bundle)).assemble(ids.business, ids.invoice, "2026-07-17T10:00:00.000Z");
    expect(result.diagnostics).toEqual([]);
    expect(result.canonicalDocument).toMatchObject({ internalDocumentNumber: "INV-2026-1001", issueTime: "09:00:00", monetaryTotals: { payableAmount: { amount: "106.00", currency: "MYR" } } });
    expect(result.supplierSnapshot).toMatchObject({ party: { taxIdentifiers: [{ scheme: "tin", value: "C12345678900", issuingCountryCode: "MY" }], registrationIdentifiers: [{ scheme: "brn", value: "202601012345", issuingCountryCode: "MY" }], billingAddress: { city: "Kuala Lumpur", countryCode: "MY" } }, msicCode: "56101" });
    expect(result.buyerSnapshot).toMatchObject({ taxIdentifiers: [{ scheme: "tin", value: "C00987654321", issuingCountryCode: "MY" }], billingAddress: { city: "Shah Alam" } });
    expect(bundle.invoice.status).toBe("paid");
  });

  it("returns precise missing-source diagnostics without invented compliance values", async () => {
    const bundle = completeBundle();
    bundle.business.taxIdentifiers = [];
    bundle.invoice.issueTime = undefined;
    bundle.invoice.items[0].classificationCode = undefined;
    const result = await new AssembleEInvoiceDocumentService(source(bundle)).assemble(ids.business, ids.invoice, "2026-07-17T10:00:00.000Z");
    expect(result.canonicalDocument).toBeNull();
    expect(result.diagnostics.map((diagnostic) => diagnostic.fieldPath)).toEqual(expect.arrayContaining([
      "supplier.taxIdentifiers", "document.issueTime", "document.lines[0].classificationCode",
    ]));
    expect(JSON.stringify(result)).not.toContain("NA");
  });

  it("does not misclassify a MYR invoice when missing source fields prevent document assembly", async () => {
    const bundle = completeBundle();
    bundle.business.msicCode = undefined;
    const result = await new AssembleEInvoiceDocumentService(source(bundle)).assemble(ids.business, ids.invoice, "2026-07-17T10:00:00.000Z");
    expect(result.canonicalDocument).toBeNull();
    expect(result.scenario).toBe("b2b_invoice");
  });

  it("persists either the complete document or its diagnostics at the explicit preparation boundary", async () => {
    const bundle = completeBundle();
    const createOrRefresh = vi.fn(async (input) => ({ id: "prepared", ...input }));
    const preparations = { createOrRefresh } as unknown as EInvoicePreparationRepository;
    await new AssembleEInvoiceDocumentService(source(bundle), preparations).prepare(ids.business, ids.invoice, "2026-07-17T10:00:00.000Z");
    expect(createOrRefresh).toHaveBeenCalledWith(expect.objectContaining({ businessId: ids.business, sourceInvoiceRevision: 4, canonicalDocument: expect.any(Object) }));
  });

  it("does not cross tenant scope when loading a source invoice", async () => {
    const bundle = completeBundle();
    await expect(new AssembleEInvoiceDocumentService(source(bundle)).assemble("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", ids.invoice, "2026-07-17T10:00:00.000Z"))
      .rejects.toThrow("not found for this business");
  });
});
