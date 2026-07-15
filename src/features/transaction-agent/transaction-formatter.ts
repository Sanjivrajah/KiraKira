import type { TransactionExtraction } from "@/features/transaction-agent/transaction.schema";

const typeLabel: Record<TransactionExtraction["type"], string> = { income: "Income", expense: "Expense", customer_payment: "Customer payment", unknown: "Unknown" };
const paymentMethodLabel: Record<TransactionExtraction["paymentMethod"], string> = { cash: "Cash", bank_transfer: "Bank transfer", card: "Card", ewallet: "E-wallet", credit: "Credit", unknown: "Unknown" };

function valueOrUnknown(value: string | null): string { return value || "Unknown"; }

export function formatTransactionDraft(draft: TransactionExtraction): string {
  const missing = draft.missingFields.length ? draft.missingFields.join(", ") : "None";
  const amount = draft.amount === null
    ? "Unknown"
    : new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(draft.amount).replace(/\s/g, "");
  return `Transaction draft\n\nType: ${typeLabel[draft.type]}\nAmount: ${amount}\nDescription: ${valueOrUnknown(draft.description || null)}\nMerchant/customer: ${valueOrUnknown(draft.merchantOrCustomer)}\nPayment method: ${paymentMethodLabel[draft.paymentMethod]}\nDate: ${valueOrUnknown(draft.transactionDate)}\nCategory: ${valueOrUnknown(draft.category)}\nConfidence: ${Math.round(draft.confidence * 100)}%\n\nMissing information: ${missing}`;
}
