import {
  calculateLineSubtotal,
  calculateLineTax,
  calculateLineTotal,
  calculateTransactionTotals,
  currencyCodeSchema,
  decimalStringSchema,
  financialTransactionSchema,
  transactionLineSchema,
  type Business,
  type CommercialDocument,
  type FinancialTransaction,
  type Party,
} from "@/domain";
import { type KeyValueStorage, browserStorage } from "@/lib/storage/browser-storage";
import { STORAGE_KEYS } from "@/lib/storage/storage-keys";
import {
  businessOnboardingToDomain,
  invoiceBuilderToDomain,
  partyEditorToDomain,
  type BusinessOnboardingViewModel,
} from "../view-models";

export const FRONTEND_DATA_VERSION = 1;
export const FRONTEND_STORAGE_KEYS = {
  version: "niagaai_frontend_data_version",
  businesses: "niagaai_domain_businesses",
  parties: "niagaai_domain_parties",
  transactions: "niagaai_domain_transactions",
  documents: "niagaai_domain_documents",
  sourceDocuments: "niagaai_domain_source_documents",
  extractionRuns: "niagaai_domain_extraction_runs",
} as const;

export interface FrontendMigrationReport {
  status: "migrated" | "current" | "failed";
  fromVersion: number;
  toVersion: number;
  migrated: { businesses: number; parties: number; transactions: number; documents: number };
  skipped: number;
  errors: string[];
}

const record = (value: unknown): Record<string, unknown> | null => value && typeof value === "object" ? value as Record<string, unknown> : null;
const string = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;
const finite = (value: unknown, fallback = 0) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
const decimal = (value: unknown) => decimalStringSchema.parse(String(finite(value)));
const timestamp = (item: Record<string, unknown>) => string(item.updatedAt, string(item.createdAt, "2026-01-01T00:00:00.000Z"));

function legacyBusiness(item: Record<string, unknown>): { domain: Business; businessType: BusinessOnboardingViewModel["businessType"] } {
  const now = timestamp(item);
  const type = (["food_beverage", "retail", "services", "online_seller", "other"].includes(string(item.type))
    ? string(item.type)
    : "other") as BusinessOnboardingViewModel["businessType"];
  const domain = businessOnboardingToDomain({
    legalName: string(item.legalName, string(item.name, "Migrated business")),
    tradingName: string(item.tradingName),
    businessType: type,
    entityType: (string(item.entityType, "sole_proprietorship")) as BusinessOnboardingViewModel["entityType"],
    preferredLanguage: string(item.preferredLanguage) === "ms" ? "ms" : "en",
    registrationScheme: "brn",
    registrationNumber: string(item.registrationNumber),
    tin: string(item.tin),
    sstRegistration: string(item.sstRegistration),
    msicCode: string(item.msicCode),
    businessActivityDescription: string(item.businessActivityDescription),
    addressLine1: string(item.addressLine1, "Address pending review"),
    addressLine2: string(item.addressLine2),
    city: string(item.city, "City pending review"),
    postcode: string(item.postcode),
    stateCode: string(item.stateCode, "17"),
    countryCode: string(item.countryCode, "MY"),
    email: string(item.email),
    phone: string(item.phone),
  }, { id: string(item.id, "business_demo"), now, createdAt: string(item.createdAt, now) });
  return { domain, businessType: type };
}

function legacyInvoice(item: Record<string, unknown>, businessId: string): { party: Party; document: CommercialDocument } {
  const now = timestamp(item);
  const invoiceId = string(item.id);
  const buyerId = string(item.customerId, `party_migrated_${invoiceId}`);
  const party = partyEditorToDomain({
    id: buyerId,
    kind: "business",
    legalName: string(item.customerName, "Migrated customer"),
    tin: string(item.buyerTin, "IG40365782020"),
    registrationScheme: "brn",
    registrationValue: string(item.registrationNumber, "NA"),
    email: string(item.customerEmail),
    phone: string(item.customerPhone),
    addressLine1: string(item.address, "Address pending review"),
    addressLine2: "",
    city: string(item.city, "City pending review"),
    postcode: string(item.postcode),
    stateCode: string(item.stateCode, "17"),
    countryCode: string(item.countryCode, "MY"),
  }, { id: buyerId, now });
  const items = Array.isArray(item.items) ? item.items.map(record).filter((line): line is Record<string, unknown> => Boolean(line)) : [];
  const document = invoiceBuilderToDomain({
    documentType: "invoice",
    invoiceNumber: string(item.invoiceNumber, invoiceId),
    issueDate: string(item.issueDate, "2026-01-01"),
    issueTime: "09:00:00",
    dueDate: string(item.dueDate, string(item.issueDate, "2026-01-01")),
    buyerId,
    originalDocumentReference: "",
    paymentModeCode: "03",
    bankAccountIdentifier: "",
    paymentTerms: string(item.paymentTerms),
    notes: string(item.notes),
    lines: items.map((line, index) => ({
      id: string(line.id, `${invoiceId}_line_${index + 1}`),
      description: string(line.description, "Migrated line"),
      quantity: String(finite(line.quantity, 1)),
      unitPrice: String(finite(line.unitPrice)),
      classificationCode: string(line.classificationCode, "022"),
      unitCode: string(line.unitCode, "C62"),
      taxTypeCode: string(line.taxTypeCode, finite(line.taxRate) > 0 ? "02" : "06"),
      taxRate: String(finite(line.taxRate)),
      exemptionReason: "",
      discountAmount: "0",
      chargeAmount: "0",
    })),
  }, { id: invoiceId, businessId, supplierPartyId: `party_${businessId}`, now });
  return { party, document };
}

function legacyTransaction(item: Record<string, unknown>, businessId: string): FinancialTransaction {
  const currency = currencyCodeSchema.parse("MYR");
  const value = decimal(item.total ?? item.amount);
  const unitPrice = { amount: value, currency };
  const subtotal = calculateLineSubtotal(decimalStringSchema.parse("1"), unitPrice);
  const totalExcludingTax = calculateLineTotal({ subtotal, taxAmount: { amount: decimalStringSchema.parse("0"), currency } });
  const taxAmount = calculateLineTax(totalExcludingTax, decimalStringSchema.parse("0"));
  const totalIncludingTax = calculateLineTotal({ subtotal, taxAmount });
  const line = transactionLineSchema.parse({
    id: `${string(item.id)}_line_1`,
    description: string(item.description, "Migrated transaction"),
    quantity: "1",
    unitCode: "C62",
    unitPrice,
    charges: [],
    taxTreatment: { taxTypeCode: "06", taxRate: "0", taxableAmount: totalExcludingTax, taxAmount },
    subtotal,
    totalExcludingTax,
    totalIncludingTax,
  });
  const totals = calculateTransactionTotals([line]);
  const now = timestamp(item);
  return financialTransactionSchema.parse({
    id: string(item.id),
    businessId,
    direction: string(item.type) === "expense" ? "expense" : "income",
    lifecycle: string(item.status) === "confirmed" || string(item.status) === "reviewed" ? "confirmed" : "review_required",
    transactionDate: string(item.date, "2026-01-01"),
    accountingDate: string(item.date, "2026-01-01"),
    counterpartyNameSnapshot: string(item.counterpartyName, string(item.customerName, string(item.merchantName))) || undefined,
    sourceLinks: [],
    description: string(item.description, "Migrated transaction"),
    categoryCode: string(item.category, "Uncategorised"),
    currency,
    lines: [line],
    totals,
    paymentStatus: "unknown",
    ...(string(item.paymentMethod) ? { paymentMethodCode: string(item.paymentMethod) } : {}),
    eInvoiceTreatment: string(item.eInvoiceTreatment, "undetermined"),
    ...(typeof item.confidenceScore === "number" ? { confidenceScore: item.confidenceScore } : {}),
    ...(string(item.status) === "confirmed" || string(item.status) === "reviewed"
      ? { confirmation: { confirmedBy: string(item.createdBy, "user_demo"), confirmedAt: now } }
      : {}),
    createdAt: string(item.createdAt, now),
    updatedAt: now,
    createdBy: string(item.createdBy, "user_demo"),
  });
}

export function runFrontendStorageMigration(storage: KeyValueStorage = browserStorage): FrontendMigrationReport {
  const fromVersion = storage.get<number>(FRONTEND_STORAGE_KEYS.version, 0);
  const empty = { businesses: 0, parties: 0, transactions: 0, documents: 0 };
  if (fromVersion >= FRONTEND_DATA_VERSION) {
    return { status: "current", fromVersion, toVersion: FRONTEND_DATA_VERSION, migrated: empty, skipped: 0, errors: [] };
  }
  const errors: string[] = [];
  let skipped = 0;
  try {
    const legacyBusinesses = storage.get<unknown>(STORAGE_KEYS.businesses, []);
    const businesses: Business[] = [];
    if (Array.isArray(legacyBusinesses)) {
      for (const value of legacyBusinesses) {
        try {
          const item = record(value);
          if (!item) throw new Error("Business is not an object.");
          businesses.push(legacyBusiness(item).domain);
        } catch (error) {
          skipped += 1;
          errors.push(error instanceof Error ? error.message : "Business migration failed.");
        }
      }
    }
    const businessId = businesses[0]?.id ?? "business_demo";
    const parties: Party[] = [];
    const documents: CommercialDocument[] = [];
    const legacyInvoices = storage.get<unknown>(STORAGE_KEYS.invoices, []);
    if (Array.isArray(legacyInvoices)) {
      for (const value of legacyInvoices) {
        try {
          const item = record(value);
          if (!item) throw new Error("Invoice is not an object.");
          const migrated = legacyInvoice(item, string(item.businessId, businessId));
          parties.push(migrated.party);
          documents.push(migrated.document);
        } catch (error) {
          skipped += 1;
          errors.push(error instanceof Error ? error.message : "Invoice migration failed.");
        }
      }
    }
    const transactions: FinancialTransaction[] = [];
    const legacyTransactions = storage.get<unknown>(STORAGE_KEYS.transactions, []);
    if (Array.isArray(legacyTransactions)) {
      for (const value of legacyTransactions) {
        try {
          const item = record(value);
          if (!item) throw new Error("Transaction is not an object.");
          transactions.push(legacyTransaction(item, string(item.businessId, businessId)));
        } catch (error) {
          skipped += 1;
          errors.push(error instanceof Error ? error.message : "Transaction migration failed.");
        }
      }
    }
    storage.set(FRONTEND_STORAGE_KEYS.businesses, businesses);
    storage.set(FRONTEND_STORAGE_KEYS.parties, parties);
    storage.set(FRONTEND_STORAGE_KEYS.transactions, transactions);
    storage.set(FRONTEND_STORAGE_KEYS.documents, documents);
    storage.set(FRONTEND_STORAGE_KEYS.version, FRONTEND_DATA_VERSION);
    return {
      status: "migrated",
      fromVersion,
      toVersion: FRONTEND_DATA_VERSION,
      migrated: { businesses: businesses.length, parties: parties.length, transactions: transactions.length, documents: documents.length },
      skipped,
      errors,
    };
  } catch (error) {
    return {
      status: "failed",
      fromVersion,
      toVersion: FRONTEND_DATA_VERSION,
      migrated: empty,
      skipped,
      errors: [...errors, error instanceof Error ? error.message : "Storage migration failed."],
    };
  }
}

export function clearFrontendDomainStorage(storage: KeyValueStorage = browserStorage): void {
  Object.values(FRONTEND_STORAGE_KEYS).forEach((key) => storage.remove(key));
}
