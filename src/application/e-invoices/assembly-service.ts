import {
  allowanceChargeSchema,
  calculateDocumentLineTotals,
  calculateDocumentMonetaryTotals,
  commercialDocumentSchema,
  currencyCodeSchema,
  decimalStringSchema,
  documentLineSchema,
  documentReferenceSchema,
  groupDocumentTaxes,
  partySchema,
  type AllowanceCharge,
  type CommercialDocument,
  type Party,
} from "@/domain";
import { mapEntityTypeToPartyKind } from "@/domain/businesses/supplier-projection";
import type {
  AssemblyDiagnostic,
  AssemblyProvenanceEntry,
  CreateOrRefreshPreparationInput,
  EInvoiceAssemblyBundle,
  EInvoicePreparationRepository,
  EInvoiceScenario,
  EInvoiceSourceRepository,
  StoredPartySource,
  SupplierSnapshot,
} from "./contracts";

export type EInvoiceAssemblyResult = CreateOrRefreshPreparationInput;

function minorToDecimal(value: number, fieldPath: string, diagnostics: AssemblyDiagnostic[]) {
  if (!Number.isSafeInteger(value)) {
    diagnostics.push({ code: "unsafe_minor_amount", fieldPath, message: "Stored minor-unit amount is outside the safe integer range.", source: "invoice" });
    return decimalStringSchema.parse("0");
  }
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, "0");
  return decimalStringSchema.parse(`${sign}${whole}.${fraction}`);
}

function sourceParty(source: StoredPartySource, diagnostics: AssemblyDiagnostic[], prefix: "buyer" | "shippingRecipient"): Party | null {
  const parsed = partySchema.safeParse({ ...source, id: source.id });
  if (parsed.success) return parsed.data;
  diagnostics.push(...parsed.error.issues.map((issue) => ({
    code: "invalid_party_source", fieldPath: `${prefix}.${issue.path.join(".")}`,
    message: issue.message, source: "party" as const,
  })));
  return null;
}

function partialParty(source: StoredPartySource | undefined): Record<string, unknown> {
  return source ? { ...source } : {};
}

function parseAdjustments(value: unknown, kind: "allowance" | "charge", diagnostics: AssemblyDiagnostic[]): AllowanceCharge[] {
  if (!Array.isArray(value)) {
    diagnostics.push({ code: "invalid_adjustments", fieldPath: `document.${kind}s`, message: "Stored adjustments must be an array.", source: "invoice" });
    return [];
  }
  return value.flatMap((item, index) => {
    const parsed = allowanceChargeSchema.safeParse(item);
    if (parsed.success && parsed.data.type === kind) return [parsed.data];
    diagnostics.push({ code: "invalid_adjustment", fieldPath: `document.${kind}s[${index}]`, message: parsed.success ? `Expected a ${kind}.` : parsed.error.issues[0]?.message ?? "Invalid adjustment.", source: "invoice" });
    return [];
  });
}

function scenario(bundle: EInvoiceAssemblyBundle, document?: CommercialDocument): EInvoiceScenario {
  if (bundle.invoice.documentType.startsWith("self_billed_")) return "self_billed_invoice";
  if (bundle.invoice.documentType.includes("credit_note")) return "credit_note";
  if (bundle.invoice.documentType.includes("debit_note")) return "debit_note";
  if (bundle.invoice.documentType.includes("refund_note")) return "refund_note";
  if (bundle.buyer?.kind === "general_public") return "consolidated_transaction";
  if (bundle.buyer?.kind === "foreign_entity") return "foreign_buyer";
  if (document && document.currency !== "MYR") return "foreign_currency";
  if (bundle.invoice.items.some((line) => line.exemptionReason)) return "tax_exempt";
  if ("trade" in bundle.invoice.supplementalFields) return "import_export";
  if (bundle.shippingRecipient) return "shipping_recipient";
  return "b2b_invoice";
}

function provenance(bundle: EInvoiceAssemblyBundle): AssemblyProvenanceEntry[] {
  const invoice = bundle.invoice.id;
  return [
    { canonicalPath: "document.internalDocumentNumber", sourceTable: "invoices", sourceColumn: "invoice_number", sourceRecordId: invoice },
    { canonicalPath: "document.issueDate", sourceTable: "invoices", sourceColumn: "issue_date", sourceRecordId: invoice },
    { canonicalPath: "document.issueTime", sourceTable: "invoices", sourceColumn: "issue_time", sourceRecordId: invoice },
    { canonicalPath: "document.lines", sourceTable: "invoice_items", sourceColumn: "*", sourceRecordId: invoice },
    { canonicalPath: "supplier", sourceTable: "businesses", sourceColumn: "identity joins", sourceRecordId: bundle.business.id },
    ...(bundle.buyer ? [{ canonicalPath: "buyer", sourceTable: "parties", sourceColumn: "identity joins", sourceRecordId: bundle.buyer.id }] : []),
  ];
}

function requireSupplier(bundle: EInvoiceAssemblyBundle, diagnostics: AssemblyDiagnostic[]): SupplierSnapshot | null {
  const business = bundle.business;
  const candidate = partySchema.safeParse({
    id: business.id,
    kind: mapEntityTypeToPartyKind(business.entityType as Parameters<typeof mapEntityTypeToPartyKind>[0]),
    legalName: business.legalName, tradingName: business.tradingName,
    roles: ["supplier", "seller"], taxIdentifiers: business.taxIdentifiers,
    registrationIdentifiers: business.registrationIdentifiers, email: business.email, phone: business.phone,
    billingAddress: business.address, defaultCurrency: business.defaultCurrency,
    createdAt: business.createdAt, updatedAt: business.updatedAt, version: business.version,
  });
  if (!candidate.success) diagnostics.push(...candidate.error.issues.map((issue) => ({ code: "invalid_supplier_source", fieldPath: `supplier.${issue.path.join(".")}`, message: issue.message, source: "business" as const })));
  const required: Array<[boolean, string, string]> = [
    [business.taxIdentifiers.some((id) => id.scheme === "tin"), "supplier.taxIdentifiers", "Supplier TIN is missing."],
    [business.registrationIdentifiers.length > 0, "supplier.registrationIdentifiers", "Supplier registration identifier is missing."],
    [Boolean(business.msicCode), "business.compliance.msicCode", "Supplier MSIC code is missing."],
    [Boolean(business.businessActivityDescription), "business.compliance.businessActivityDescription", "Supplier business activity description is missing."],
    [Boolean(business.phone), "supplier.phone", "Supplier phone is missing."],
    [Boolean(business.address), "supplier.billingAddress", "Supplier primary address is missing."],
  ];
  for (const [present, fieldPath, message] of required) if (!present) diagnostics.push({ code: "missing_supplier_field", fieldPath, message, source: "business" });
  return candidate.success ? { party: candidate.data, msicCode: business.msicCode, businessActivityDescription: business.businessActivityDescription } : null;
}

export class AssembleEInvoiceDocumentService {
  constructor(private readonly sources: EInvoiceSourceRepository, private readonly preparations?: EInvoicePreparationRepository) {}

  async assemble(businessId: string, invoiceId: string, now: string, documentOverrides: Record<string, unknown> = {}): Promise<EInvoiceAssemblyResult> {
    const bundle = await this.sources.loadAssemblyBundle(businessId, invoiceId);
    if (!bundle) throw new Error("Source invoice was not found for this business.");
    const diagnostics: AssemblyDiagnostic[] = [];
    const supplier = requireSupplier(bundle, diagnostics);
    if (!bundle.buyer) diagnostics.push({ code: "missing_buyer", fieldPath: "buyer", message: "A buyer record is required.", source: "party" });
    const buyer = bundle.buyer ? sourceParty(bundle.buyer, diagnostics, "buyer") : null;
    const shipping = bundle.shippingRecipient ? sourceParty(bundle.shippingRecipient, diagnostics, "shippingRecipient") : null;
    const invoice = bundle.invoice;
    const supplementalFields: Record<string, unknown> = {
      ...invoice.supplementalFields,
      ...documentOverrides,
      ...(shipping ? { _shippingRecipientSnapshot: shipping } : {}),
    };
    const override = (key: string) => typeof supplementalFields[key] === "string" && supplementalFields[key] ? supplementalFields[key] as string : undefined;
    const issueTime = override("documentOnlyIssueTime") ?? invoice.issueTime;
    const exchangeRate = override("exchangeRate") ?? invoice.exchangeRate;
    const billingPeriodStart = override("billingPeriodStart") ?? invoice.billingPeriodStart;
    const billingPeriodEnd = override("billingPeriodEnd") ?? invoice.billingPeriodEnd;
    if (!issueTime) diagnostics.push({ code: "missing_issue_time", fieldPath: "document.issueTime", message: "Issue time is missing; it must be captured or finalised at a controlled server boundary.", source: "invoice" });
    const currencyResult = currencyCodeSchema.safeParse(invoice.currency);
    if (!currencyResult.success) diagnostics.push({ code: "invalid_currency", fieldPath: "document.currency", message: currencyResult.error.issues[0]?.message ?? "Invalid currency.", source: "invoice" });
    const currency = currencyResult.success ? currencyResult.data : currencyCodeSchema.parse("MYR");
    const lines = invoice.items.flatMap((item, index) => {
      const field = `document.lines[${index}]`;
      if (!item.unitCode) diagnostics.push({ code: "missing_unit_code", fieldPath: `${field}.unitCode`, message: "Line unit code is missing.", source: "invoice_line" });
      if (!item.classificationCode) diagnostics.push({ code: "missing_classification", fieldPath: `${field}.classificationCode`, message: "Line classification is missing.", source: "invoice_line" });
      const quantity = decimalStringSchema.safeParse(item.quantity);
      const taxRate = decimalStringSchema.safeParse(item.taxRate);
      if (!quantity.success || !taxRate.success) {
        diagnostics.push({ code: "invalid_line_decimal", fieldPath: field, message: "Line quantity or tax rate is not a canonical decimal.", source: "invoice_line" });
        return [];
      }
      const unitPrice = { amount: minorToDecimal(item.unitPriceMinor, `${field}.unitPrice`, diagnostics), currency };
      const allowances = item.discountMinor > 0 ? [{ type: "allowance" as const, reason: "Line discount", amount: { amount: minorToDecimal(item.discountMinor, `${field}.allowances`, diagnostics), currency } }] : [];
      const charges = item.chargeMinor > 0 ? [{ type: "charge" as const, reason: "Line charge", amount: { amount: minorToDecimal(item.chargeMinor, `${field}.charges`, diagnostics), currency } }] : [];
      const totals = calculateDocumentLineTotals({ quantity: quantity.data, unitPrice, allowances, charges, taxRate: taxRate.data });
      return [documentLineSchema.parse({ id: item.id, description: item.description, quantity: quantity.data, unitCode: item.unitCode ?? "missing", unitPrice, classificationCode: item.classificationCode ?? "missing", taxTreatment: { taxTypeCode: item.taxTypeCode, taxRate: taxRate.data, taxableAmount: totals.taxExclusiveAmount, taxAmount: totals.taxAmount, ...(item.exemptionReason ? { exemption: { reason: item.exemptionReason } } : {}) }, allowances, charges, totals, itemMetadata: { ...item.itemMetadata, ...(item.countryOfOrigin ? { countryOfOrigin: item.countryOfOrigin } : {}), ...(item.tariffCode ? { tariffCode: item.tariffCode } : {}) } })];
    });
    const allowances = parseAdjustments(invoice.documentAllowances, "allowance", diagnostics);
    const charges = parseAdjustments(invoice.documentCharges, "charge", diagnostics);
    const taxTotals = lines.length ? groupDocumentTaxes(lines) : [];
    const roundingAmount = { amount: minorToDecimal(invoice.roundingMinor, "document.monetaryTotals.roundingAmount", diagnostics), currency };
    const prepaidAmount = { amount: minorToDecimal(invoice.prepaidMinor, "document.monetaryTotals.prepaidAmount", diagnostics), currency };
    let document: CommercialDocument | null = null;
    if (lines.length) {
      const totals = calculateDocumentMonetaryTotals({ lines, allowances, charges, taxTotals, roundingAmount, prepaidAmount });
      const references = Array.isArray(invoice.documentReferences) ? invoice.documentReferences.flatMap((reference, index) => {
        const parsed = documentReferenceSchema.safeParse(reference);
        if (parsed.success) return [parsed.data];
        diagnostics.push({ code: "invalid_reference", fieldPath: `document.references[${index}]`, message: parsed.error.issues[0]?.message ?? "Invalid reference.", source: "invoice" });
        return [];
      }) : [];
      const parsed = commercialDocumentSchema.safeParse({
        id: invoice.id, businessId, documentType: invoice.documentType, internalDocumentNumber: invoice.invoiceNumber,
        issueDate: invoice.issueDate, issueTime, supplierPartyId: bundle.business.id,
        buyerPartyId: buyer?.id, shippingRecipientPartyId: shipping?.id, sourceTransactionIds: [], currency,
        taxCurrency: invoice.taxCurrency, exchangeRate, lines, allowances, charges, taxTotals,
        monetaryTotals: totals,
        ...(invoice.paymentModeCode ? { paymentInstructions: { paymentModeCode: invoice.paymentModeCode, bankAccountIdentifier: invoice.bankAccountIdentifier, paymentTerms: invoice.paymentTerms, dueDate: invoice.dueDate, paymentReference: invoice.paymentReference } } : {}),
        ...(billingPeriodStart && billingPeriodEnd ? { billingPeriod: { startDate: billingPeriodStart, endDate: billingPeriodEnd } } : {}),
        references, invoicePurpose: invoice.invoicePurpose, notes: invoice.notes ? [invoice.notes] : [], status: "draft",
        createdAt: invoice.createdAt, updatedAt: now, createdBy: invoice.createdBy, updatedBy: invoice.updatedBy, version: invoice.version,
      });
      if (parsed.success && supplier && buyer && diagnostics.length === 0) document = parsed.data;
      else if (!parsed.success) diagnostics.push(...parsed.error.issues.map((issue) => ({ code: "invalid_commercial_document", fieldPath: `document.${issue.path.join(".")}`, message: issue.message, source: "invoice" as const })));
    }
    return {
      businessId, sourceInvoiceId: invoice.id, sourceInvoiceRevision: invoice.version,
      documentType: invoice.documentType,
      scenario: ["customsFormReference", "incoterms", "freeTradeAgreement", "certifiedExporterAuthorisation", "customsForm2"].some((key) => supplementalFields[key])
        ? "import_export"
        : scenario(bundle, document ?? undefined),
      canonicalDocument: document,
      supplierSnapshot: supplier ?? { businessId: bundle.business.id }, buyerSnapshot: buyer ?? partialParty(bundle.buyer),
      supplementalFields, provenance: provenance(bundle), diagnostics,
    };
  }

  async prepare(businessId: string, invoiceId: string, now: string) {
    if (!this.preparations) throw new Error("A preparation repository is required to persist assembled documents.");
    return this.preparations.createOrRefresh(await this.assemble(businessId, invoiceId, now));
  }
}
