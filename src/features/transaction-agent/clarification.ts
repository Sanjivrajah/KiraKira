import { transactionExtractionSchema, type TransactionExtraction } from "@/features/transaction-agent/transaction.schema";
import type { ConversationRequestedField } from "@/features/transaction-agent/conversation-state";

const questions: Record<ConversationRequestedField, string> = {
  amount: "What was the transaction amount?",
  type: "What was this payment or transaction for?",
  purpose: "What was this payment or transaction for?",
  transactionDate: "When did this transaction happen?",
  paymentMethod: "How was it paid — cash, bank transfer, card, e-wallet, or credit?",
  merchantOrCustomer: "Who was the merchant, supplier, or customer?",
};

export function getRequiredMissingFields(draft: TransactionExtraction): ConversationRequestedField[] {
  const parsed = normalizeMissingFields(draft);
  const missing = new Set(parsed.missingFields);
  if (parsed.amount === null || parsed.amount <= 0) missing.add("amount");
  if (parsed.type === "unknown") missing.add("type");
  if (!parsed.description) missing.add("purpose");
  if (!parsed.transactionDate) missing.add("transactionDate");
  if (parsed.paymentMethod === "unknown") missing.add("paymentMethod");
  const priority: ConversationRequestedField[] = ["amount", "type", "purpose", "transactionDate", "paymentMethod", "merchantOrCustomer"];
  return priority.filter((field) => missing.has(field));
}

/** Removes stale model-reported missing fields once their validated value is present. */
export function normalizeMissingFields(draft: TransactionExtraction): TransactionExtraction {
  const parsed = transactionExtractionSchema.parse(draft);
  return {
    ...parsed,
    missingFields: parsed.missingFields.filter((field) => {
      if (field === "amount") return parsed.amount === null || parsed.amount <= 0;
      if (field === "type") return parsed.type === "unknown";
      if (field === "description" || field === "purpose") return !parsed.description;
      if (field === "transactionDate") return !parsed.transactionDate;
      if (field === "paymentMethod") return parsed.paymentMethod === "unknown";
      return !parsed.merchantOrCustomer;
    }),
  };
}

export function selectClarificationField(draft: TransactionExtraction): ConversationRequestedField | null {
  return getRequiredMissingFields(draft)[0] ?? null;
}

export function getClarificationQuestion(field: ConversationRequestedField): string { return questions[field]; }
