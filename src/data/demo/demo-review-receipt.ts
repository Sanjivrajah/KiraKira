import { DEMO_SOURCE_EXTRACTIONS } from "@/data/demo/demo-extractions";
import { extractionRunSchema } from "@/domain";
import { receiptExtractionSchema } from "@/lib/openai/receipt-schema";

/**
 * Sanitized, deterministic fixture for the judged evidence-review path.
 * The prepared total is intentionally wrong so the owner correction and audit
 * story remain demonstrable without an external AI provider.
 */
export const DEMO_REVIEW_RECEIPT_TEXT = [
  "MAJU MART",
  "Cooking ingredients and packaging",
  "SUBTOTAL  RM 86.40",
  "TAX       RM 0.00",
  "TOTAL     RM 86.40",
  "Paid by debit card",
].join("\n");

export const DEMO_REVIEW_RECEIPT_EXTRACTION = receiptExtractionSchema.parse({
  documentType: "receipt",
  merchantName: {
    value: "Maju Mart",
    evidenceText: "MAJU MART",
    confidence: 0.97,
  },
  invoiceNumber: {
    value: null,
    evidenceText: null,
    confidence: 0,
  },
  documentDate: {
    value: "2026-07-13",
    evidenceText: "13/07/2026",
    confidence: 0.95,
  },
  currency: {
    value: "MYR",
    evidenceText: "RM",
    confidence: 0.99,
  },
  lineItems: [{
    description: "Cooking ingredients and packaging",
    quantity: 1,
    unitPrice: 86.4,
    amount: 86.4,
    evidenceText: "Cooking ingredients and packaging  RM 86.40",
    confidence: 0.91,
  }],
  subtotal: {
    value: 86.4,
    evidenceText: "SUBTOTAL RM 86.40",
    confidence: 0.96,
  },
  tax: {
    value: 0,
    evidenceText: "TAX RM 0.00",
    confidence: 0.98,
  },
  total: {
    value: 68.4,
    evidenceText: "TOTAL RM 86.40",
    confidence: 0.58,
  },
  paymentMethod: {
    value: "Debit card",
    evidenceText: "Paid by debit card",
    confidence: 0.9,
  },
  category: {
    value: "Inventory",
    evidenceText: "Cooking ingredients and packaging",
    confidence: 0.84,
  },
  missingFields: ["invoiceNumber"],
  warnings: [
    "The prepared total does not match the total printed on the receipt.",
  ],
  overallConfidence: 0.81,
});

const receiptProvenance = DEMO_SOURCE_EXTRACTIONS.find(
  ({ sourceDocument }) => sourceDocument.sourceType === "receipt",
);

if (!receiptProvenance) throw new Error("The demo receipt provenance fixture is missing.");

export const DEMO_REVIEW_SOURCE_DOCUMENT = receiptProvenance.sourceDocument;

export const DEMO_REVIEW_EXTRACTION_RUN = extractionRunSchema.parse({
  ...receiptProvenance.extractionRun,
  normalizedProposedResult: {
    ...receiptProvenance.extractionRun.normalizedProposedResult,
    total: { amount: "68.40", currency: "MYR" },
  },
  fields: receiptProvenance.extractionRun.fields.map((field) =>
    field.fieldPath === "total.amount"
      ? { ...field, normalizedValue: "68.40", confidence: 0.58 }
      : field,
  ),
  warnings: [{
    code: "other",
    severity: "warning",
    fieldPath: "total.amount",
    message: "The prepared amount differs from the total printed on the receipt.",
    suggestedAction: "Compare the amount with TOTAL RM 86.40 and correct the prepared record.",
  }],
  overallConfidence: 0.81,
});
