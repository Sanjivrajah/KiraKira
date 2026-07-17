export type InvoiceFieldRequirement = "mandatory" | "conditional" | "optional";
export type InvoiceFieldScope = "business" | "buyer" | "document" | "line" | "calculated" | "signing";
export type InvoiceFieldSource = "business" | "party" | "invoice" | "invoice_line" | "calculated" | "supplemental" | "signing";
export type InvoiceFieldAvailability = "available" | "partial" | "derived" | "stage_later";
export type InvoiceValueSchema = "text" | "email" | "phone" | "identifier" | "code" | "date" | "time" | "decimal" | "money" | "address" | "signature" | "allowance_charge";

export interface InvoiceFieldDefinition {
  key: string;
  guidelineNumber?: number;
  group: "guideline" | "sdk_expansion" | "annexure";
  label: string;
  requirement: InvoiceFieldRequirement;
  appliesWhen: string;
  scope: InvoiceFieldScope;
  canonicalPath: string;
  ublPath: string;
  valueSchema: InvoiceValueSchema;
  cardinality: string;
  characterLimit?: number;
  codeList?: string;
  source: InvoiceFieldSource;
  persistenceLocation: string;
  availability: InvoiceFieldAvailability;
  gap?: string;
  sourceVersion: string;
  verifiedAt: string;
}

type Options = Partial<Pick<InvoiceFieldDefinition, "appliesWhen" | "cardinality" | "characterLimit" | "codeList" | "availability" | "gap">>;
const SOURCE_VERSION = "HASiL e-Invoice Guideline 4.6 PDF / 4.7 listing; MyInvois SDK Invoice 1.1";
const VERIFIED_AT = "2026-07-17";
const INVOICE = "invoices / e_invoice_documents canonical snapshot";
const LINE = "invoice_items / e_invoice_documents canonical snapshot";
const SUPPLIER = "businesses + business identifier/address/contact tables / supplier_snapshot";
const BUYER = "parties + party identifier/address tables / buyer_snapshot";
const SUPPLEMENT = "e_invoice_documents.supplemental_fields";

function field(input: Omit<InvoiceFieldDefinition, "sourceVersion" | "verifiedAt">): InvoiceFieldDefinition {
  return { ...input, sourceVersion: SOURCE_VERSION, verifiedAt: VERIFIED_AT };
}

function guideline(
  guidelineNumber: number, key: string, label: string, requirement: InvoiceFieldRequirement,
  scope: InvoiceFieldScope, canonicalPath: string, ublPath: string,
  valueSchema: InvoiceValueSchema, source: InvoiceFieldSource, persistenceLocation: string,
  options: Options = {},
) {
  return field({
    guidelineNumber, key, group: "guideline", label, requirement, scope, canonicalPath, ublPath,
    valueSchema, source, persistenceLocation, appliesWhen: options.appliesWhen ?? "standard Invoice v1.1",
    cardinality: options.cardinality ?? (requirement === "optional" ? "0..1" : "1"),
    availability: options.availability ?? "available", characterLimit: options.characterLimit,
    codeList: options.codeList, gap: options.gap,
  });
}

function related(
  group: "sdk_expansion" | "annexure", key: string, label: string,
  requirement: InvoiceFieldRequirement, scope: InvoiceFieldScope, canonicalPath: string,
  ublPath: string, valueSchema: InvoiceValueSchema, source: InvoiceFieldSource,
  persistenceLocation: string, options: Options = {},
) {
  return field({
    key, group, label, requirement, scope, canonicalPath, ublPath, valueSchema, source,
    persistenceLocation, appliesWhen: options.appliesWhen ?? "supplied",
    cardinality: options.cardinality ?? (requirement === "mandatory" ? "1" : "0..1"),
    availability: options.availability ?? "available", characterLimit: options.characterLimit,
    codeList: options.codeList, gap: options.gap,
  });
}

const g = guideline;
const x = (...args: Parameters<typeof related> extends [unknown, ...infer Rest] ? Rest : never) => related("sdk_expansion", ...args);
const a = (...args: Parameters<typeof related> extends [unknown, ...infer Rest] ? Rest : never) => related("annexure", ...args);

/** Shared typed contract for capture, readiness, persistence and later UBL mapping. */
export const INVOICE_V1_1_FIELD_REGISTRY: readonly InvoiceFieldDefinition[] = Object.freeze([
  g(1, "supplier.name", "Supplier's Name", "mandatory", "business", "supplier.legalName", "AccountingSupplierParty.Party.PartyLegalEntity.RegistrationName", "text", "business", SUPPLIER, { characterLimit: 300 }),
  g(2, "buyer.name", "Buyer's Name", "mandatory", "buyer", "buyer.legalName", "AccountingCustomerParty.Party.PartyLegalEntity.RegistrationName", "text", "party", BUYER, { characterLimit: 300 }),
  g(3, "supplier.tin", "Supplier's TIN", "mandatory", "business", "supplier.taxIdentifiers[tin]", "AccountingSupplierParty.Party.PartyIdentification[schemeID=TIN].ID", "identifier", "business", SUPPLIER),
  g(4, "supplier.registration", "Supplier's Registration / Identification / Passport Number", "mandatory", "business", "supplier.registrationIdentifiers[primary]", "AccountingSupplierParty.Party.PartyIdentification[schemeID=BRN|NRIC|PASSPORT|ARMY].ID", "identifier", "business", SUPPLIER, { codeList: "MyInvois identifier schemes" }),
  g(5, "supplier.sst", "Supplier's SST Registration Number", "conditional", "business", "supplier.taxIdentifiers[sst]", "AccountingSupplierParty.Party.PartyIdentification[schemeID=SST].ID", "identifier", "business", SUPPLIER, { appliesWhen: "supplier is SST registered" }),
  g(6, "supplier.tourism_tax", "Supplier's Tourism Tax Registration Number", "conditional", "business", "supplier.taxIdentifiers[tourism_tax]", "AccountingSupplierParty.Party.PartyIdentification[schemeID=TTX].ID", "identifier", "business", SUPPLIER, { appliesWhen: "supplier is tourism-tax registered" }),
  g(7, "supplier.email", "Supplier's e-mail", "optional", "business", "supplier.email", "AccountingSupplierParty.Party.Contact.ElectronicMail", "email", "business", SUPPLIER),
  g(8, "supplier.msic", "Supplier's MSIC Code", "mandatory", "business", "business.compliance.msicCode", "AccountingSupplierParty.Party.IndustryClassificationCode", "code", "business", SUPPLIER, { characterLimit: 5, codeList: "MSIC" }),
  g(9, "supplier.activity", "Supplier's Business Activity Description", "mandatory", "business", "business.compliance.businessActivityDescription", "AccountingSupplierParty.Party.IndustryClassificationCode.name", "text", "business", SUPPLIER, { characterLimit: 300 }),
  g(10, "buyer.tin", "Buyer's TIN", "mandatory", "buyer", "buyer.taxIdentifiers[tin]", "AccountingCustomerParty.Party.PartyIdentification[schemeID=TIN].ID", "identifier", "party", BUYER),
  g(11, "buyer.registration", "Buyer's Registration / Identification / Passport Number", "mandatory", "buyer", "buyer.registrationIdentifiers[primary]", "AccountingCustomerParty.Party.PartyIdentification.ID", "identifier", "party", BUYER, { codeList: "MyInvois identifier schemes" }),
  g(12, "buyer.sst", "Buyer's SST Registration Number", "conditional", "buyer", "buyer.taxIdentifiers[sst]", "AccountingCustomerParty.Party.PartyIdentification[schemeID=SST].ID", "identifier", "party", BUYER, { appliesWhen: "buyer is SST registered" }),
  g(13, "buyer.email", "Buyer's e-mail", "optional", "buyer", "buyer.email", "AccountingCustomerParty.Party.Contact.ElectronicMail", "email", "party", BUYER),
  g(14, "supplier.address", "Supplier's Address", "mandatory", "business", "supplier.billingAddress", "AccountingSupplierParty.Party.PostalAddress", "address", "business", SUPPLIER),
  g(15, "buyer.address", "Buyer's Address", "mandatory", "buyer", "buyer.billingAddress", "AccountingCustomerParty.Party.PostalAddress", "address", "party", BUYER),
  g(16, "supplier.phone", "Supplier's Contact Number", "mandatory", "business", "supplier.phone", "AccountingSupplierParty.Party.Contact.Telephone", "phone", "business", SUPPLIER),
  g(17, "buyer.phone", "Buyer's Contact Number", "mandatory", "buyer", "buyer.phone", "AccountingCustomerParty.Party.Contact.Telephone", "phone", "party", BUYER),
  g(18, "document.version", "e-Invoice Version", "mandatory", "calculated", "preparation.documentVersion", "InvoiceTypeCode.listVersionID", "code", "calculated", "e_invoice_documents.document_version", { availability: "derived" }),
  g(19, "document.type", "e-Invoice Type", "mandatory", "document", "document.documentType", "InvoiceTypeCode", "code", "invoice", INVOICE, { codeList: "MyInvois document types" }),
  g(20, "document.number", "e-Invoice Code / Number", "mandatory", "document", "document.internalDocumentNumber", "ID", "text", "invoice", INVOICE, { characterLimit: 100 }),
  g(21, "document.original_reference", "Original e-Invoice Reference Number", "conditional", "document", "document.references[original_invoice]", "BillingReference.InvoiceDocumentReference.UUID", "identifier", "invoice", INVOICE, { appliesWhen: "credit, debit or refund note" }),
  g(22, "document.issued_at", "e-Invoice Date and Time", "mandatory", "document", "document.issueDate + document.issueTime", "IssueDate + IssueTime", "time", "invoice", INVOICE, { cardinality: "1 each" }),
  g(23, "document.signature", "Issuer's Digital Signature", "mandatory", "signing", "submission.signature", "UBLExtensions.UBLExtension.ExtensionContent.Signature", "signature", "signing", "Stage 3 signing boundary", { appliesWhen: "submission", availability: "stage_later", gap: "Out of scope until signing stage." }),
  g(24, "document.currency", "Invoice Currency Code", "mandatory", "document", "document.currency", "DocumentCurrencyCode", "code", "invoice", INVOICE, { characterLimit: 3, codeList: "ISO 4217" }),
  g(25, "document.exchange_rate", "Currency Exchange Rate", "conditional", "document", "document.exchangeRate", "TaxExchangeRate.CalculationRate", "decimal", "invoice", INVOICE, { appliesWhen: "document currency is not MYR" }),
  g(26, "document.billing_frequency", "Frequency of Billing", "optional", "document", "supplemental.billingFrequency", "InvoicePeriod.DescriptionCode", "code", "supplemental", SUPPLEMENT, { availability: "partial", gap: "No current capture UI." }),
  g(27, "document.billing_period", "Billing Period", "optional", "document", "document.billingPeriod", "InvoicePeriod", "date", "invoice", INVOICE),
  g(28, "line.classification", "Classification", "mandatory", "line", "document.lines[].classificationCode", "InvoiceLine.Item.CommodityClassification.ItemClassificationCode", "code", "invoice_line", LINE, { appliesWhen: "each line", cardinality: "1..n per line", codeList: "MyInvois classification" }),
  g(29, "line.description", "Description of Product or Service", "mandatory", "line", "document.lines[].description", "InvoiceLine.Item.Description", "text", "invoice_line", LINE, { appliesWhen: "each line", cardinality: "1 per line", characterLimit: 300 }),
  g(30, "line.unit_price", "Unit Price", "mandatory", "line", "document.lines[].unitPrice", "InvoiceLine.Price.PriceAmount", "money", "invoice_line", LINE, { appliesWhen: "each line", cardinality: "1 per line" }),
  g(31, "line.tax_type", "Tax Type", "mandatory", "line", "document.lines[].taxTreatment.taxTypeCode", "InvoiceLine.TaxTotal.TaxSubtotal.TaxCategory.ID", "code", "invoice_line", LINE, { appliesWhen: "each line and tax group", codeList: "MyInvois tax types" }),
  g(32, "line.tax_rate", "Tax Rate", "conditional", "line", "document.lines[].taxTreatment.taxRate", "TaxCategory.Percent", "decimal", "invoice_line", LINE, { appliesWhen: "tax treatment uses a rate" }),
  g(33, "tax.amount", "Tax Amount", "mandatory", "calculated", "document.lines[].taxTreatment.taxAmount + document.taxTotals", "TaxTotal.TaxAmount", "money", "calculated", "invoice_items.tax_minor / canonical snapshot", { availability: "derived" }),
  g(34, "tax.exemption_details", "Details of Tax Exemption", "conditional", "line", "document.lines[].taxTreatment.exemption", "TaxCategory.TaxExemptionReason", "text", "invoice_line", LINE, { appliesWhen: "tax exemption applies" }),
  g(35, "tax.exempt_amount", "Amount Exempted from Tax", "conditional", "calculated", "document.lines[].taxTreatment.taxableAmount", "TaxSubtotal.TaxableAmount", "money", "calculated", "canonical snapshot", { appliesWhen: "tax exemption applies", availability: "derived" }),
  g(36, "line.subtotal", "Subtotal", "mandatory", "calculated", "document.lines[].totals.lineExtensionAmount", "InvoiceLine.LineExtensionAmount", "money", "calculated", "invoice_items.subtotal_minor / canonical snapshot", { appliesWhen: "each line", availability: "derived" }),
  g(37, "totals.excluding_tax", "Total Excluding Tax", "mandatory", "calculated", "document.monetaryTotals.taxExclusiveAmount", "LegalMonetaryTotal.TaxExclusiveAmount", "money", "calculated", "canonical snapshot", { availability: "derived" }),
  g(38, "totals.including_tax", "Total Including Tax", "mandatory", "calculated", "document.monetaryTotals.taxInclusiveAmount", "LegalMonetaryTotal.TaxInclusiveAmount", "money", "calculated", "canonical snapshot", { availability: "derived" }),
  g(39, "totals.net", "Total Net Amount", "optional", "calculated", "document.monetaryTotals.lineExtensionAmount", "LegalMonetaryTotal.LineExtensionAmount", "money", "calculated", "canonical snapshot", { availability: "derived" }),
  g(40, "totals.payable", "Total Payable Amount", "mandatory", "calculated", "document.monetaryTotals.payableAmount", "LegalMonetaryTotal.PayableAmount", "money", "calculated", "invoices.total_minor / canonical snapshot", { availability: "derived" }),
  g(41, "totals.rounding", "Rounding Amount", "optional", "calculated", "document.monetaryTotals.roundingAmount", "LegalMonetaryTotal.PayableRoundingAmount", "money", "calculated", "invoices.rounding_minor / canonical snapshot", { availability: "derived" }),
  g(42, "tax.taxable_by_type", "Total Taxable Amount Per Tax Type", "optional", "calculated", "document.taxTotals[].subtotals[].taxableAmount", "TaxTotal.TaxSubtotal.TaxableAmount", "money", "calculated", "canonical snapshot", { cardinality: "0..n", availability: "derived" }),
  g(43, "line.quantity", "Quantity", "optional", "line", "document.lines[].quantity", "InvoiceLine.InvoicedQuantity", "decimal", "invoice_line", LINE, { appliesWhen: "supplied; required internally by Niaga" }),
  g(44, "line.unit", "Measurement", "optional", "line", "document.lines[].unitCode", "InvoiceLine.InvoicedQuantity.unitCode", "code", "invoice_line", LINE, { appliesWhen: "quantity supplied", codeList: "UN/ECE Recommendation 20" }),
  g(45, "allowance.rate", "Discount Rate", "optional", "line", "document.lines[].allowances[].percentage", "AllowanceCharge.MultiplierFactorNumeric", "decimal", "invoice_line", LINE, { cardinality: "0..n", availability: "partial", gap: "Legacy rows retain amount but not rate/base." }),
  g(46, "allowance.amount", "Discount Amount", "optional", "line", "document.lines[].allowances[].amount", "AllowanceCharge.Amount", "allowance_charge", "invoice_line", LINE, { cardinality: "0..n" }),
  g(47, "charge.rate", "Fee / Charge Rate", "optional", "line", "document.lines[].charges[].percentage", "AllowanceCharge.MultiplierFactorNumeric", "decimal", "invoice_line", LINE, { cardinality: "0..n", availability: "partial", gap: "Legacy rows retain amount but not rate/base." }),
  g(48, "charge.amount", "Fee / Charge Amount", "optional", "line", "document.lines[].charges[].amount", "AllowanceCharge.Amount", "allowance_charge", "invoice_line", LINE, { cardinality: "0..n" }),
  g(49, "payment.mode", "Payment Mode", "optional", "document", "document.paymentInstructions.paymentModeCode", "PaymentMeans.PaymentMeansCode", "code", "invoice", INVOICE, { codeList: "MyInvois payment modes" }),
  g(50, "payment.bank_account", "Supplier's Bank Account Number", "optional", "document", "document.paymentInstructions.bankAccountIdentifier", "PaymentMeans.PayeeFinancialAccount.ID", "identifier", "invoice", INVOICE),
  g(51, "payment.terms", "Payment Terms", "optional", "document", "document.paymentInstructions.paymentTerms", "PaymentTerms.Note", "text", "invoice", INVOICE),
  g(52, "prepayment.amount", "Prepayment Amount", "optional", "document", "document.monetaryTotals.prepaidAmount", "LegalMonetaryTotal.PrepaidAmount", "money", "invoice", INVOICE),
  g(53, "prepayment.date", "Prepayment Date", "optional", "document", "supplemental.prepayment.date", "PrepaidPayment.PaidDate", "date", "invoice", INVOICE),
  g(54, "prepayment.reference", "Prepayment Reference Number", "optional", "document", "supplemental.prepayment.reference", "PrepaidPayment.ID", "identifier", "invoice", INVOICE),
  g(55, "document.bill_reference", "Bill Reference Number", "optional", "document", "document.references[bill]", "AdditionalDocumentReference.ID", "identifier", "invoice", INVOICE),

  ...(["supplier", "buyer", "shippingRecipient"] as const).flatMap((party) => {
    const source = party === "supplier" ? "business" as const : "party" as const;
    const scope = party === "supplier" ? "business" as const : "buyer" as const;
    const persistence = party === "supplier" ? SUPPLIER : BUYER;
    const required = party === "shippingRecipient" ? "optional" as const : "mandatory" as const;
    const condition = party === "shippingRecipient" ? "shipping recipient supplied" : "standard Invoice v1.1";
    return [
      x(`${party}.address.line0`, `${party} address line 0`, required, scope, `${party}.billingAddress.addressLines[0]`, `${party}.PostalAddress.AddressLine[0].Line`, "text", source, persistence, { appliesWhen: condition }),
      x(`${party}.address.line1`, `${party} address line 1`, "optional", scope, `${party}.billingAddress.addressLines[1]`, `${party}.PostalAddress.AddressLine[1].Line`, "text", source, persistence),
      x(`${party}.address.line2`, `${party} address line 2`, "optional", scope, `${party}.billingAddress.addressLines[2]`, `${party}.PostalAddress.AddressLine[2].Line`, "text", source, persistence),
      x(`${party}.address.postcode`, `${party} postal zone`, "optional", scope, `${party}.billingAddress.postcode`, `${party}.PostalAddress.PostalZone`, "text", source, persistence),
      x(`${party}.address.city`, `${party} city name`, required, scope, `${party}.billingAddress.city`, `${party}.PostalAddress.CityName`, "text", source, persistence, { appliesWhen: condition }),
      x(`${party}.address.state`, `${party} state`, required, scope, `${party}.billingAddress.stateCode`, `${party}.PostalAddress.CountrySubentityCode`, "code", source, persistence, { appliesWhen: condition, codeList: "MyInvois state codes" }),
      x(`${party}.address.country`, `${party} country`, required, scope, `${party}.billingAddress.countryCode`, `${party}.PostalAddress.Country.IdentificationCode`, "code", source, persistence, { appliesWhen: condition, codeList: "ISO 3166-1 alpha-3", availability: "partial", gap: "Canonical storage is alpha-2; mapper converts deliberately." }),
    ];
  }),
  x("document.issue_date", "Issue date", "mandatory", "document", "document.issueDate", "IssueDate", "date", "invoice", INVOICE),
  x("document.issue_time", "Issue time", "mandatory", "document", "document.issueTime", "IssueTime", "time", "invoice", INVOICE),
  x("billing.start_date", "Billing period start", "optional", "document", "document.billingPeriod.startDate", "InvoicePeriod.StartDate", "date", "invoice", INVOICE),
  x("billing.end_date", "Billing period end", "optional", "document", "document.billingPeriod.endDate", "InvoicePeriod.EndDate", "date", "invoice", INVOICE),
  x("document.tax_currency", "Tax currency", "optional", "document", "document.taxCurrency", "TaxCurrencyCode", "code", "invoice", INVOICE, { codeList: "ISO 4217" }),
  x("tax.total", "Total tax amount", "mandatory", "calculated", "document.taxTotals[].taxAmount", "TaxTotal.TaxAmount", "money", "calculated", "canonical snapshot", { availability: "derived" }),
  x("tax.subtotals", "Tax subtotals", "mandatory", "calculated", "document.taxTotals[].subtotals[]", "TaxTotal.TaxSubtotal", "money", "calculated", "canonical snapshot", { cardinality: "1..n", availability: "derived" }),
  x("allowance_charge.repeatable", "Repeatable invoice allowance/charge", "optional", "document", "document.allowances[] + document.charges[]", "AllowanceCharge[]", "allowance_charge", "invoice", INVOICE, { cardinality: "0..n" }),
  x("line.classifications.repeatable", "Repeatable line classifications", "mandatory", "line", "document.lines[].classificationCode", "InvoiceLine.Item.CommodityClassification[]", "code", "invoice_line", LINE, { cardinality: "1..n", availability: "partial", gap: "Canonical model currently stores one primary classification." }),
  x("prepayment.time", "Prepayment time", "optional", "document", "supplemental.prepayment.time", "PrepaidPayment.PaidTime", "time", "invoice", INVOICE),
  x("signature.structure", "UBL signature extension", "mandatory", "signing", "submission.signature", "UBLExtensions.UBLExtension.ExtensionContent.Signature", "signature", "signing", "Stage 3 signing boundary", { appliesWhen: "submission", availability: "stage_later", gap: "Out of scope until signing stage." }),

  a("annexure.customs_form_1_9", "Reference Number of Customs Form No.1, 9, etc.", "conditional", "document", "document.references[customs_form]", "AdditionalDocumentReference[documentType=Customs].ID", "identifier", "supplemental", SUPPLEMENT, { appliesWhen: "relevant import/export of goods", cardinality: "1..n", availability: "partial", gap: "No current capture UI." }),
  a("annexure.shipping_name", "Shipping Recipient's Name", "optional", "buyer", "shippingRecipient.legalName", "Delivery.DeliveryParty.PartyLegalEntity.RegistrationName", "text", "party", BUYER, { appliesWhen: "recipient differs from buyer" }),
  a("annexure.shipping_address", "Shipping Recipient's Address", "optional", "buyer", "shippingRecipient.billingAddress", "Delivery.DeliveryAddress", "address", "party", BUYER, { appliesWhen: "recipient differs from buyer" }),
  a("annexure.shipping_tin", "Shipping Recipient's TIN", "optional", "buyer", "shippingRecipient.taxIdentifiers[tin]", "Delivery.DeliveryParty.PartyIdentification[schemeID=TIN].ID", "identifier", "party", BUYER, { appliesWhen: "recipient differs from buyer" }),
  a("annexure.shipping_registration", "Shipping Recipient's Registration / Identification / Passport Number", "optional", "buyer", "shippingRecipient.registrationIdentifiers[primary]", "Delivery.DeliveryParty.PartyIdentification.ID", "identifier", "party", BUYER, { appliesWhen: "recipient differs from buyer" }),
  a("annexure.incoterms", "Incoterms", "optional", "document", "supplemental.trade.incoterms", "Delivery.DeliveryTerms.ID", "code", "supplemental", SUPPLEMENT, { appliesWhen: "import/export of goods", availability: "partial", gap: "No current capture UI." }),
  a("annexure.tariff", "Product Tariff Code", "optional", "line", "document.lines[].itemMetadata.tariffCode", "InvoiceLine.Item.CommodityClassification.ItemClassificationCode[listID=PTC]", "code", "invoice_line", LINE, { appliesWhen: "goods" }),
  a("annexure.fta", "Free Trade Agreement Information", "optional", "document", "supplemental.trade.freeTradeAgreement", "AdditionalDocumentReference.DocumentDescription", "text", "supplemental", SUPPLEMENT, { appliesWhen: "export", availability: "partial", gap: "No current capture UI." }),
  a("annexure.certified_exporter", "Certified Exporter Authorisation Number", "optional", "document", "supplemental.trade.certifiedExporterAuthorisation", "AccountingSupplierParty.AdditionalAccountID", "identifier", "supplemental", SUPPLEMENT, { appliesWhen: "export", availability: "partial", gap: "No current capture UI." }),
  a("annexure.customs_form_2", "Reference Number of Customs Form No.2", "optional", "document", "supplemental.trade.customsForm2", "AdditionalDocumentReference.ID", "identifier", "supplemental", SUPPLEMENT, { appliesWhen: "export declaration", availability: "partial", gap: "No current capture UI." }),
  a("annexure.country_origin", "Country of Origin", "optional", "line", "document.lines[].itemMetadata.countryOfOrigin", "InvoiceLine.Item.OriginCountry.IdentificationCode", "code", "invoice_line", LINE, { appliesWhen: "goods", codeList: "ISO 3166-1 alpha-3", availability: "partial", gap: "Canonical storage is alpha-2; mapper converts deliberately." }),
  a("annexure.other_charges", "Details of Other Charges", "optional", "document", "document.charges[]", "AllowanceCharge[ChargeIndicator=true]", "allowance_charge", "supplemental", INVOICE, { cardinality: "0..n" }),
]);

export const INVOICE_V1_1_GUIDELINE_FIELDS = INVOICE_V1_1_FIELD_REGISTRY.filter((field) => field.group === "guideline");
export const INVOICE_V1_1_SDK_EXPANSIONS = INVOICE_V1_1_FIELD_REGISTRY.filter((field) => field.group === "sdk_expansion");
export const INVOICE_V1_1_ANNEXURE_FIELDS = INVOICE_V1_1_FIELD_REGISTRY.filter((field) => field.group === "annexure");

export interface InvoiceScenarioOverlay {
  key: "b2b_invoice" | "consolidated_transaction" | "foreign_buyer" | "self_billed_invoice" | "credit_note" | "debit_note" | "refund_note" | "tax_exempt" | "foreign_currency" | "import_export" | "shipping_recipient";
  appliesWhen: string;
  relevantFieldKeys: readonly string[];
  placeholderPolicy: "official_rules_only";
  sourceVersion: string;
  verifiedAt: string;
}

const overlay = (key: InvoiceScenarioOverlay["key"], appliesWhen: string, relevantFieldKeys: readonly string[]): InvoiceScenarioOverlay => ({
  key, appliesWhen, relevantFieldKeys, placeholderPolicy: "official_rules_only", sourceVersion: SOURCE_VERSION, verifiedAt: VERIFIED_AT,
});

/** Explicit applicability overlays. Values are never substituted by this metadata. */
export const INVOICE_V1_1_SCENARIO_OVERLAYS: readonly InvoiceScenarioOverlay[] = Object.freeze([
  overlay("b2b_invoice", "standard Malaysian B2B or B2G invoice", ["supplier.tin", "buyer.tin", "buyer.registration"]),
  overlay("consolidated_transaction", "consolidated e-Invoice or General Public", ["buyer.name", "buyer.tin", "buyer.registration", "buyer.phone", "line.classification"]),
  overlay("foreign_buyer", "buyer is a foreign entity", ["buyer.tin", "buyer.registration", "buyer.address", "buyer.address.country"]),
  overlay("self_billed_invoice", "document type is self-billed", ["document.type", "supplier.tin", "buyer.tin", "line.classification"]),
  overlay("credit_note", "document type is credit note", ["document.type", "document.original_reference"]),
  overlay("debit_note", "document type is debit note", ["document.type", "document.original_reference"]),
  overlay("refund_note", "document type is refund note", ["document.type", "document.original_reference"]),
  overlay("tax_exempt", "one or more lines use an exempt treatment", ["line.tax_type", "tax.exemption_details", "tax.exempt_amount"]),
  overlay("foreign_currency", "document currency is not MYR", ["document.currency", "document.exchange_rate", "document.tax_currency"]),
  overlay("import_export", "goods are imported or exported", ["annexure.customs_form_1_9", "annexure.incoterms", "annexure.tariff", "annexure.country_origin"]),
  overlay("shipping_recipient", "shipping recipient differs from buyer", ["annexure.shipping_name", "annexure.shipping_address", "annexure.shipping_tin", "annexure.shipping_registration"]),
]);
