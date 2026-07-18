import type { ReceiptExtraction } from "@/lib/openai/receipt-schema";
import { transactionExtractionSchema, type TransactionExtraction } from "@/features/transaction-agent/transaction.schema";

function paymentMethodFromReceipt(value: string | null): TransactionExtraction["paymentMethod"] {
  const normalized = value?.trim().toLocaleLowerCase("en-MY") ?? "";
  if (/\b(cash|tunai)\b/.test(normalized)) return "cash";
  if (/\b(bank|transfer|duitnow|fpx)\b/.test(normalized)) return "bank_transfer";
  if (/\b(card|visa|mastercard|debit)\b/.test(normalized)) return "card";
  if (/\b(e-?wallet|touch n go|tng|grabpay|boost)\b/.test(normalized)) return "ewallet";
  if (/\bcredit\b/.test(normalized)) return "credit";
  return "unknown";
}

function receiptDescription(extraction: ReceiptExtraction): string {
  const descriptions = extraction.lineItems.map((item) => item.description.trim()).filter(Boolean);
  if (descriptions.length === 0) return "";
  const visible = descriptions.slice(0, 4).join(", ");
  return descriptions.length > 4 ? `${visible}, and ${descriptions.length - 4} more items` : visible;
}

export function hasMultipleReceiptTransactions(extraction: ReceiptExtraction): boolean {
  return extraction.warnings.some((warning) => /multiple receipts|multiple transactions|more than one receipt|separately totaled transactions/i.test(warning));
}

export function receiptToTransactionExtraction(extraction: ReceiptExtraction): TransactionExtraction {
  const description = receiptDescription(extraction);
  const paymentMethod = paymentMethodFromReceipt(extraction.paymentMethod.value);
  const transactionDate = /^\d{4}-\d{2}-\d{2}$/.test(extraction.documentDate.value ?? "") ? extraction.documentDate.value : null;
  const missingFields: TransactionExtraction["missingFields"] = ["type"];
  if (extraction.total.value === null || extraction.total.value <= 0) missingFields.push("amount");
  if (!description) missingFields.push("purpose");
  if (!transactionDate) missingFields.push("transactionDate");
  if (paymentMethod === "unknown") missingFields.push("paymentMethod");

  return transactionExtractionSchema.parse({
    type: "unknown",
    amount: extraction.total.value,
    currency: "MYR",
    description,
    merchantOrCustomer: extraction.merchantName.value,
    paymentMethod,
    transactionDate,
    category: extraction.category.value,
    quantity: extraction.lineItems.length === 1 ? extraction.lineItems[0]?.quantity ?? null : null,
    unit: null,
    missingFields,
    confidence: extraction.overallConfidence,
  });
}
