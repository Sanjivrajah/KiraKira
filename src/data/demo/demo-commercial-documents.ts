import {
  calculateDocumentLineTotals,
  calculateDocumentMonetaryTotals,
  commercialDocumentSchema,
  currencyCodeSchema,
  decimalStringSchema,
  documentLineSchema,
  groupDocumentTaxes,
  paymentAllocationSchema,
  paymentSchema,
  type CommercialDocument,
} from "@/domain";

const myr = currencyCodeSchema.parse("MYR");
const zero = decimalStringSchema.parse("0");

function makeLine(input: {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
}) {
  const price = { amount: decimalStringSchema.parse(input.unitPrice), currency: myr };
  const totals = calculateDocumentLineTotals({
    quantity: decimalStringSchema.parse(input.quantity),
    unitPrice: price,
    taxRate: zero,
  });
  return documentLineSchema.parse({
    id: input.id,
    description: input.description,
    quantity: input.quantity,
    unitCode: "C62",
    unitPrice: price,
    classificationCode: "GENERAL",
    taxTreatment: {
      taxTypeCode: "NOT_APPLICABLE",
      taxRate: "0",
      taxableAmount: totals.taxExclusiveAmount,
      taxAmount: totals.taxAmount,
    },
    allowances: [],
    charges: [],
    totals,
    itemMetadata: {},
  });
}

interface DemoDocumentInput {
  id: string;
  number: string;
  buyerPartyId: string;
  issueDate: string;
  dueDate: string;
  line: { id: string; description: string; quantity: string; unitPrice: string };
  sourceTransactionIds: string[];
  notes?: string[];
  createdAt: string;
  updatedAt: string;
}

function makeDocument(input: DemoDocumentInput): CommercialDocument {
  const line = makeLine(input.line);
  const taxTotals = groupDocumentTaxes([line]);
  const monetaryTotals = calculateDocumentMonetaryTotals({ lines: [line], taxTotals });
  return commercialDocumentSchema.parse({
    id: input.id,
    businessId: "business_demo",
    documentType: "invoice",
    internalDocumentNumber: input.number,
    issueDate: input.issueDate,
    issueTime: "09:00:00",
    supplierPartyId: "party_business_demo",
    buyerPartyId: input.buyerPartyId,
    sourceTransactionIds: input.sourceTransactionIds,
    currency: "MYR",
    lines: [line],
    allowances: [],
    charges: [],
    taxTotals,
    monetaryTotals,
    paymentInstructions: {
      paymentModeCode: "BANK_TRANSFER",
      paymentTerms: "Payment due within 14 days.",
      dueDate: input.dueDate,
      paymentReference: input.number,
    },
    references: [],
    notes: input.notes ?? [],
    status: "submitted",
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    createdBy: "demo-lina",
  });
}

const documentInputs: DemoDocumentInput[] = [
  {
    id: "inv_1024",
    number: "INV-1024",
    buyerPartyId: "customer_kedai_murni",
    issueDate: "2026-06-26",
    dueDate: "2026-07-10",
    line: { id: "item_1024_1", description: "Corporate lunch catering", quantity: "1", unitPrice: "850" },
    sourceTransactionIds: [],
    notes: ["Thank you for your business."],
    createdAt: "2026-06-26T03:00:00.000Z",
    updatedAt: "2026-06-26T03:00:00.000Z",
  },
  {
    id: "inv_1023",
    number: "INV-1023",
    buyerPartyId: "customer_teras_digital",
    issueDate: "2026-07-06",
    dueDate: "2026-07-20",
    line: { id: "item_1023_1", description: "Office lunch order", quantity: "4", unitPrice: "155" },
    sourceTransactionIds: ["txn_006"],
    createdAt: "2026-07-06T02:00:00.000Z",
    updatedAt: "2026-07-06T02:00:00.000Z",
  },
  {
    id: "inv_1022",
    number: "INV-1022",
    buyerPartyId: "customer_suria_events",
    issueDate: "2026-06-18",
    dueDate: "2026-07-02",
    line: { id: "item_1022_1", description: "Event catering deposit", quantity: "1", unitPrice: "1200" },
    sourceTransactionIds: ["txn_003"],
    createdAt: "2026-06-18T05:30:00.000Z",
    updatedAt: "2026-07-01T07:00:00.000Z",
  },
];

export const DEMO_COMMERCIAL_DOCUMENTS = documentInputs.map(makeDocument);

export const DEMO_DOCUMENT_CUSTOMER_SNAPSHOTS = {
  inv_1024: { name: "Kedai Murni", email: "accounts@kedaimurni.demo", tin: "IG40365782020" },
  inv_1023: { name: "Teras Digital", email: "finance@terasdigital.demo", tin: "IG40365782020" },
  inv_1022: { name: "Suria Events", tin: "IG40365782020" },
} as const;

export const DEMO_DOMAIN_PAYMENTS = [
  paymentSchema.parse({
    id: "payment_inv_1022",
    businessId: "business_demo",
    paymentDate: "2026-07-01T07:00:00.000Z",
    amount: { amount: "1200", currency: "MYR" },
    paymentModeCode: "BANK_TRANSFER",
    bankReference: "DEMO-BANK-1022",
    status: "completed",
    createdAt: "2026-07-01T07:00:00.000Z",
    updatedAt: "2026-07-01T07:00:00.000Z",
    createdBy: "demo-lina",
  }),
];

export const DEMO_PAYMENT_ALLOCATIONS = [
  paymentAllocationSchema.parse({
    id: "allocation_inv_1022",
    paymentId: "payment_inv_1022",
    documentId: "inv_1022",
    allocatedAmount: { amount: "1200", currency: "MYR" },
    allocatedAt: "2026-07-01T07:00:00.000Z",
    createdAt: "2026-07-01T07:00:00.000Z",
    updatedAt: "2026-07-01T07:00:00.000Z",
    createdBy: "demo-lina",
  }),
];
