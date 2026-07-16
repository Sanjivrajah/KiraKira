import {
  businessDomainSchema,
  calculateDocumentLineTotals,
  calculateDocumentMonetaryTotals,
  commercialDocumentSchema,
  currencyCodeSchema,
  decimalStringSchema,
  documentLineSchema,
  groupDocumentTaxes,
  partySchema,
  type AllowanceCharge,
  type CommercialDocument,
  type DocumentLine,
} from "@/domain";
import type { MyInvoisMappingContext } from "../../mappers";

const createdAt = "2026-07-15T00:00:00.000Z";
const myr = currencyCodeSchema.parse("MYR");

export const UBL_FIXTURE_SUPPLIER = partySchema.parse({
  id: "fixture_supplier",
  kind: "business",
  legalName: "Niaga Fixture Sdn. Bhd.",
  roles: ["supplier", "seller"],
  taxIdentifiers: [
    { scheme: "tin", value: "C2584563222", issuingCountryCode: "MY" },
    { scheme: "sst", value: "W10-1808-32000001", issuingCountryCode: "MY" },
  ],
  registrationIdentifiers: [{ scheme: "brn", value: "202601012345", issuingCountryCode: "MY" }],
  email: "billing@niaga.example",
  phone: "+60312345678",
  billingAddress: {
    addressLines: ["1 Jalan Niaga", "Taman Perniagaan"],
    city: "Shah Alam",
    postcode: "40100",
    stateCode: "10",
    countryCode: "MY",
  },
  createdAt,
  updatedAt: createdAt,
});

export const UBL_FIXTURE_BUYER = partySchema.parse({
  id: "fixture_buyer",
  kind: "business",
  legalName: "Pembeli Fixture Sdn. Bhd.",
  roles: ["buyer", "customer"],
  taxIdentifiers: [{ scheme: "tin", value: "C2584563200", issuingCountryCode: "MY" }],
  registrationIdentifiers: [{ scheme: "brn", value: "202501012345", issuingCountryCode: "MY" }],
  email: "accounts@pembeli.example",
  phone: "+60387654321",
  billingAddress: {
    addressLines: ["2 Jalan Pembeli"],
    city: "Kuala Lumpur",
    postcode: "50480",
    stateCode: "14",
    countryCode: "MY",
  },
  createdAt,
  updatedAt: createdAt,
});

export const UBL_FIXTURE_BUSINESS = businessDomainSchema.parse({
  id: "fixture_business",
  legalName: UBL_FIXTURE_SUPPLIER.legalName,
  entityType: "private_limited_company",
  compliance: {
    tin: UBL_FIXTURE_SUPPLIER.taxIdentifiers[0],
    registration: UBL_FIXTURE_SUPPLIER.registrationIdentifiers[0],
    sstRegistrations: [UBL_FIXTURE_SUPPLIER.taxIdentifiers[1]],
    msicCode: "01111",
    businessActivityDescription: "Growing of maize",
  },
  contact: { email: UBL_FIXTURE_SUPPLIER.email, phone: UBL_FIXTURE_SUPPLIER.phone },
  address: UBL_FIXTURE_SUPPLIER.billingAddress,
  defaultCurrency: "MYR",
  preferredLanguage: "en",
  timezone: "Asia/Kuala_Lumpur",
  createdAt,
  updatedAt: createdAt,
});

function line(input: {
  id: string;
  description: string;
  quantity?: string;
  unitPrice?: string;
  taxTypeCode?: string;
  taxRate?: string;
  classificationCode?: string;
  exemptionReason?: string;
  allowances?: AllowanceCharge[];
}): DocumentLine {
  const quantity = decimalStringSchema.parse(input.quantity ?? "1");
  const unitPrice = { amount: decimalStringSchema.parse(input.unitPrice ?? "100"), currency: myr };
  const taxRate = decimalStringSchema.parse(input.taxRate ?? "6");
  const allowances = input.allowances ?? [];
  const totals = calculateDocumentLineTotals({ quantity, unitPrice, taxRate, allowances });
  return documentLineSchema.parse({
    id: input.id,
    description: input.description,
    quantity,
    unitCode: "C62",
    unitPrice,
    classificationCode: input.classificationCode ?? "022",
    taxTreatment: {
      taxTypeCode: input.taxTypeCode ?? "02",
      taxRate,
      taxableAmount: totals.taxExclusiveAmount,
      taxAmount: totals.taxAmount,
      ...(input.exemptionReason ? { exemption: { code: "E", reason: input.exemptionReason } } : {}),
    },
    allowances,
    charges: [],
    totals,
    itemMetadata: { countryOfOrigin: "MY" },
  });
}

function document(input: {
  id: string;
  number: string;
  lines: DocumentLine[];
  buyerPartyId?: string;
  allowances?: AllowanceCharge[];
}): CommercialDocument {
  const allowances = input.allowances ?? [];
  const taxTotals = groupDocumentTaxes(input.lines);
  const monetaryTotals = calculateDocumentMonetaryTotals({ lines: input.lines, allowances, taxTotals });
  return commercialDocumentSchema.parse({
    id: input.id,
    businessId: UBL_FIXTURE_BUSINESS.id,
    documentType: "invoice",
    internalDocumentNumber: input.number,
    issueDate: "2026-07-15",
    issueTime: "09:30:00",
    supplierPartyId: UBL_FIXTURE_SUPPLIER.id,
    buyerPartyId: input.buyerPartyId ?? UBL_FIXTURE_BUYER.id,
    sourceTransactionIds: [],
    currency: "MYR",
    lines: input.lines,
    allowances,
    charges: [],
    taxTotals,
    monetaryTotals,
    paymentInstructions: {
      paymentModeCode: "03",
      bankAccountIdentifier: "1234567890",
      paymentTerms: "Payment due within 30 days.",
      dueDate: "2026-08-14",
      paymentReference: input.number,
    },
    references: [],
    notes: ["Generated from deterministic Session 6 fixtures."],
    status: "ready_for_submission",
    createdAt,
    updatedAt: createdAt,
  });
}

export const UBL_STANDARD_B2B_INVOICE = document({
  id: "fixture_invoice_b2b",
  number: "INV-FIXTURE-001",
  lines: [line({ id: "1", description: "Business consulting", quantity: "2", unitPrice: "100" })],
});

export const UBL_FIXTURE_B2C_BUYER = partySchema.parse({
  ...UBL_FIXTURE_BUYER,
  id: "fixture_b2c_buyer",
  kind: "individual",
  legalName: "Aisyah Binti Ahmad",
  taxIdentifiers: [{ scheme: "tin", value: "IG12345678901", issuingCountryCode: "MY" }],
  registrationIdentifiers: [{ scheme: "nric", value: "900101101234", issuingCountryCode: "MY" }],
});

export const UBL_B2C_INVOICE = document({
  id: "fixture_invoice_b2c",
  number: "INV-FIXTURE-002",
  buyerPartyId: UBL_FIXTURE_B2C_BUYER.id,
  lines: [line({ id: "1", description: "Consumer service", unitPrice: "50" })],
});

export const UBL_TAX_EXEMPT_INVOICE = document({
  id: "fixture_invoice_exempt",
  number: "INV-FIXTURE-003",
  lines: [line({
    id: "1",
    description: "Exempt educational material",
    unitPrice: "75",
    taxTypeCode: "E",
    taxRate: "0",
    exemptionReason: "Exempt educational supplies",
  })],
});

export const UBL_MULTIPLE_TAX_GROUPS_INVOICE = document({
  id: "fixture_invoice_multi_tax",
  number: "INV-FIXTURE-004",
  lines: [
    line({ id: "1", description: "Service-tax item", unitPrice: "100", taxTypeCode: "02", taxRate: "6" }),
    line({ id: "2", description: "Non-taxable item", unitPrice: "40", taxTypeCode: "06", taxRate: "0" }),
  ],
});

const documentAllowance: AllowanceCharge = {
  type: "allowance",
  reason: "Promotional discount",
  percentage: decimalStringSchema.parse("10"),
  baseAmount: { amount: decimalStringSchema.parse("200"), currency: myr },
  amount: { amount: decimalStringSchema.parse("20"), currency: myr },
};

export const UBL_DOCUMENT_DISCOUNT_INVOICE = document({
  id: "fixture_invoice_discount",
  number: "INV-FIXTURE-005",
  lines: [line({ id: "1", description: "Discounted service", quantity: "2", unitPrice: "100" })],
  allowances: [documentAllowance],
});

export const UBL_FIXTURE_FOREIGN_BUYER = partySchema.parse({
  ...UBL_FIXTURE_BUYER,
  id: "fixture_foreign_buyer",
  kind: "foreign_entity",
  legalName: "Foreign Fixture Pte. Ltd.",
  taxIdentifiers: [{ scheme: "tin", value: "EI00000000030", issuingCountryCode: "MY" }],
  registrationIdentifiers: [{ scheme: "brn", value: "202600123N", issuingCountryCode: "SG" }],
  billingAddress: {
    addressLines: ["1 Market Street"],
    city: "Singapore",
    postcode: "048946",
    stateCode: "17",
    countryCode: "SG",
  },
});

export const UBL_FOREIGN_BUYER_INVOICE = document({
  id: "fixture_invoice_foreign",
  number: "INV-FIXTURE-006",
  buyerPartyId: UBL_FIXTURE_FOREIGN_BUYER.id,
  lines: [line({ id: "1", description: "Export consulting", unitPrice: "300" })],
});

export const UBL_MAPPABLE_INVOICE_FIXTURES = Object.freeze([
  { name: "standard B2B invoice", document: UBL_STANDARD_B2B_INVOICE, buyer: UBL_FIXTURE_BUYER },
  { name: "B2C invoice", document: UBL_B2C_INVOICE, buyer: UBL_FIXTURE_B2C_BUYER },
  { name: "tax-exempt invoice", document: UBL_TAX_EXEMPT_INVOICE, buyer: UBL_FIXTURE_BUYER },
  { name: "multiple tax groups", document: UBL_MULTIPLE_TAX_GROUPS_INVOICE, buyer: UBL_FIXTURE_BUYER },
  { name: "document discount", document: UBL_DOCUMENT_DISCOUNT_INVOICE, buyer: UBL_FIXTURE_BUYER },
  { name: "foreign buyer", document: UBL_FOREIGN_BUYER_INVOICE, buyer: UBL_FIXTURE_FOREIGN_BUYER },
]);

export function fixtureMappingContext(buyer = UBL_FIXTURE_BUYER): MyInvoisMappingContext {
  return { supplier: UBL_FIXTURE_SUPPLIER, buyer, business: UBL_FIXTURE_BUSINESS };
}

export const UBL_PENDING_FIXTURES = Object.freeze([
  { name: "self-billed invoice", reason: "Pending a dedicated self-billed mapper." },
  { name: "credit note referencing an invoice", reason: "Pending a credit-note mapper and BillingReference support." },
]);

