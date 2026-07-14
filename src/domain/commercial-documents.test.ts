import { describe, expect, it } from "vitest";
import {
  DEMO_COMMERCIAL_DOCUMENTS,
  DEMO_DOMAIN_PAYMENTS,
  DEMO_INVOICES,
  DEMO_PAYMENT_ALLOCATIONS,
} from "@/data/demo";
import {
  calculateDocumentLineTotals,
  calculateDocumentMonetaryTotals,
  commercialDocumentSchema,
  currencyCodeSchema,
  decimalStringSchema,
  deriveDocumentPaymentState,
  documentIdSchema,
  documentLineSchema,
  groupDocumentTaxes,
  isoDateSchema,
  paymentAllocationSchema,
  paymentSchema,
  reconcilePaymentAllocations,
  type AllowanceCharge,
  type CommercialDocumentType,
  type DocumentLine,
  type DocumentReference,
  type MoneyValue,
} from ".";

const TIMESTAMP = "2026-07-14T08:00:00.000Z";

function money(amount: string, currency = "MYR"): MoneyValue {
  return {
    amount: decimalStringSchema.parse(amount),
    currency: currencyCodeSchema.parse(currency),
  };
}

function adjustment(
  type: "allowance" | "charge",
  amount: string,
  reason = type === "allowance" ? "Discount" : "Delivery",
): AllowanceCharge {
  return { type, reason, amount: money(amount) };
}

function makeLine({
  id = "document_line_001",
  quantity = "1",
  unitPrice = "100",
  taxRate = "0",
  allowances = [],
  charges = [],
}: {
  id?: string;
  quantity?: string;
  unitPrice?: string;
  taxRate?: string;
  allowances?: AllowanceCharge[];
  charges?: AllowanceCharge[];
} = {}): DocumentLine {
  const price = money(unitPrice);
  const rate = decimalStringSchema.parse(taxRate);
  const totals = calculateDocumentLineTotals({
    quantity: decimalStringSchema.parse(quantity),
    unitPrice: price,
    allowances,
    charges,
    taxRate: rate,
  });
  return documentLineSchema.parse({
    id,
    description: "Commercial item",
    quantity,
    unitCode: "C62",
    unitPrice: price,
    classificationCode: "GENERAL",
    taxTreatment: {
      taxTypeCode: taxRate === "0" ? "NOT_APPLICABLE" : "SALES_TAX",
      taxRate,
      taxableAmount: totals.taxExclusiveAmount,
      taxAmount: totals.taxAmount,
    },
    allowances,
    charges,
    totals,
    itemMetadata: { countryOfOrigin: "MY" },
  });
}

function makeDocument({
  documentType = "invoice",
  lines = [makeLine()],
  references = [],
  allowances = [],
  charges = [],
}: {
  documentType?: CommercialDocumentType;
  lines?: DocumentLine[];
  references?: DocumentReference[];
  allowances?: AllowanceCharge[];
  charges?: AllowanceCharge[];
} = {}) {
  const taxTotals = groupDocumentTaxes(lines);
  const monetaryTotals = calculateDocumentMonetaryTotals({
    lines,
    allowances,
    charges,
    taxTotals,
  });
  return {
    id: `document_${documentType}`,
    businessId: "business_demo",
    documentType,
    internalDocumentNumber: `DOC-${documentType}`,
    issueDate: "2026-07-14",
    issueTime: "16:00:00",
    supplierPartyId: "party_supplier",
    buyerPartyId: "party_buyer",
    sourceTransactionIds: ["transaction_source_001"],
    currency: "MYR",
    lines,
    allowances,
    charges,
    taxTotals,
    monetaryTotals,
    paymentInstructions: {
      paymentModeCode: "BANK_TRANSFER",
      dueDate: "2026-07-28",
      paymentReference: "DOC-REFERENCE",
    },
    references,
    notes: [],
    status: "draft",
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };
}

const originalReference: DocumentReference = {
  type: "original_invoice",
  internalDocumentId: documentIdSchema.parse("document_original"),
  issueDate: isoDateSchema.parse("2026-07-01"),
};

describe("commercial document family", () => {
  it("accepts a standard invoice without assigning payment status", () => {
    const result = commercialDocumentSchema.parse(makeDocument());
    expect(result.documentType).toBe("invoice");
    expect(result.status).toBe("draft");
    expect(result).not.toHaveProperty("paymentStatus");
  });

  it.each(["credit_note", "debit_note"] as const)(
    "accepts a %s that references the original invoice",
    (documentType) => {
      const result = commercialDocumentSchema.parse(makeDocument({ documentType, references: [originalReference] }));
      expect(result.references[0].type).toBe("original_invoice");
    },
  );

  it("accepts a refund note and rejects it without an original reference", () => {
    expect(
      commercialDocumentSchema.safeParse(
        makeDocument({ documentType: "refund_note", references: [originalReference] }),
      ).success,
    ).toBe(true);
    expect(
      commercialDocumentSchema.safeParse(makeDocument({ documentType: "refund_note" })).success,
    ).toBe(false);
  });

  it("accepts a self-billed invoice as a distinct document type", () => {
    const result = commercialDocumentSchema.parse(makeDocument({ documentType: "self_billed_invoice" }));
    expect(result.documentType).toBe("self_billed_invoice");
  });

  it("calculates a document-level discount", () => {
    const discount: AllowanceCharge = {
      type: "allowance",
      reason: "Ten percent loyalty discount",
      percentage: decimalStringSchema.parse("10"),
      baseAmount: money("100"),
      amount: money("10"),
    };
    const result = commercialDocumentSchema.parse(makeDocument({ allowances: [discount] }));
    expect(result.monetaryTotals.allowanceTotal.amount).toBe("10.00");
    expect(result.monetaryTotals.payableAmount.amount).toBe("90.00");
  });

  it("calculates a line-level discount independently", () => {
    const line = makeLine({ quantity: "2", unitPrice: "50", allowances: [adjustment("allowance", "15")] });
    const result = commercialDocumentSchema.parse(makeDocument({ lines: [line] }));
    expect(result.lines[0].totals.lineExtensionAmount.amount).toBe("100.00");
    expect(result.lines[0].totals.taxExclusiveAmount.amount).toBe("85.00");
  });

  it("groups tax subtotals by tax type and rate", () => {
    const lines = [
      makeLine({ id: "tax_line_1", unitPrice: "100", taxRate: "8" }),
      makeLine({ id: "tax_line_2", unitPrice: "50", taxRate: "8" }),
    ];
    const result = commercialDocumentSchema.parse(makeDocument({ lines }));
    expect(result.taxTotals[0].subtotals).toHaveLength(1);
    expect(result.taxTotals[0].subtotals[0].taxableAmount.amount).toBe("150.00");
    expect(result.taxTotals[0].taxAmount.amount).toBe("12.00");
    expect(result.monetaryTotals.payableAmount.amount).toBe("162.00");
  });

  it("supports every required self-billed adjustment variant", () => {
    for (const documentType of [
      "self_billed_credit_note",
      "self_billed_debit_note",
      "self_billed_refund_note",
    ] as const) {
      expect(
        commercialDocumentSchema.safeParse(makeDocument({ documentType, references: [originalReference] })).success,
      ).toBe(true);
    }
  });
});

describe("payments and allocations", () => {
  const firstPayment = paymentSchema.parse({
    id: "payment_001",
    businessId: "business_demo",
    paymentDate: TIMESTAMP,
    amount: money("60"),
    paymentModeCode: "BANK_TRANSFER",
    status: "completed",
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  });
  const secondPayment = paymentSchema.parse({
    id: "payment_002",
    businessId: "business_demo",
    paymentDate: TIMESTAMP,
    amount: money("40"),
    paymentModeCode: "CARD",
    status: "completed",
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  });

  const allocate = (id: string, paymentId: string, documentId: string, amount: string) =>
    paymentAllocationSchema.parse({
      id,
      paymentId,
      documentId,
      allocatedAmount: money(amount),
      allocatedAt: TIMESTAMP,
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    });

  it("derives a partially-paid state from completed allocations", () => {
    const state = deriveDocumentPaymentState({
      documentId: documentIdSchema.parse("document_invoice"),
      payableAmount: money("100"),
      dueDate: isoDateSchema.parse("2026-07-28"),
      allocations: [allocate("allocation_1", firstPayment.id, "document_invoice", "60")],
      payments: [firstPayment],
      asOfDate: isoDateSchema.parse("2026-07-20"),
    });
    expect(state).toMatchObject({
      settlementStatus: "partially_paid",
      effectiveStatus: "partially_paid",
      allocatedAmount: { amount: "60.00" },
      outstandingAmount: { amount: "40.00" },
    });
  });

  it("allows multiple payments to settle one document", () => {
    const allocations = [
      allocate("allocation_1", firstPayment.id, "document_invoice", "60"),
      allocate("allocation_2", secondPayment.id, "document_invoice", "40"),
    ];
    const state = deriveDocumentPaymentState({
      documentId: documentIdSchema.parse("document_invoice"),
      payableAmount: money("100"),
      allocations,
      payments: [firstPayment, secondPayment],
      asOfDate: isoDateSchema.parse("2026-07-20"),
    });
    expect(state.settlementStatus).toBe("paid");
    expect(state.outstandingAmount.amount).toBe("0.00");
  });

  it("allows one payment to allocate across multiple documents", () => {
    const allocations = [
      allocate("allocation_1", firstPayment.id, "document_invoice", "40"),
      allocate("allocation_2", firstPayment.id, "document_other", "20"),
    ];
    expect(reconcilePaymentAllocations(firstPayment, allocations)).toMatchObject({
      allocatedAmount: { amount: "60.00" },
      overAllocated: false,
    });
  });

  it("derives overdue only when an outstanding document is past due", () => {
    const state = deriveDocumentPaymentState({
      documentId: documentIdSchema.parse("document_invoice"),
      payableAmount: money("100"),
      dueDate: isoDateSchema.parse("2026-07-10"),
      allocations: [],
      payments: [],
      asOfDate: isoDateSchema.parse("2026-07-14"),
    });
    expect(state).toMatchObject({ settlementStatus: "unpaid", effectiveStatus: "overdue", overdue: true });
  });
});

describe("demo invoice migration", () => {
  it("uses canonical documents and allocations while preserving current UI fixtures", () => {
    expect(DEMO_COMMERCIAL_DOCUMENTS).toHaveLength(3);
    expect(DEMO_DOMAIN_PAYMENTS).toHaveLength(1);
    expect(DEMO_PAYMENT_ALLOCATIONS).toHaveLength(1);
    expect(DEMO_INVOICES.map((invoice) => invoice.total)).toEqual([850, 620, 1200]);
    expect(DEMO_INVOICES.map((invoice) => invoice.status)).toEqual(["sent", "sent", "paid"]);
    expect(DEMO_INVOICES[2].amountPaid).toBe(1200);
  });
});
