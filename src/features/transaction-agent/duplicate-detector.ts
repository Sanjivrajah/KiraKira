import type { ConfirmedTransaction, TransactionDraft } from "@/features/transaction-agent/transaction-record.schema";

const fillerWords = new Set(["a", "an", "the", "for", "of", "to", "and", "at", "di", "untuk", "dari", "yang"]);

export function normaliseDuplicateText(value: string | null | undefined): string {
  return (value ?? "")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token && !fillerWords.has(token))
    .join(" ");
}

export function descriptionSimilarity(left: string, right: string): number {
  const leftTokens = new Set(normaliseDuplicateText(left).split(" ").filter(Boolean));
  const rightTokens = new Set(normaliseDuplicateText(right).split(" ").filter(Boolean));
  if (!leftTokens.size || !rightTokens.size) return 0;
  let common = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) common += 1;
  return common / Math.max(leftTokens.size, rightTokens.size);
}

export function isLikelyDuplicate(draft: TransactionDraft, transaction: ConfirmedTransaction): boolean {
  if (draft.type !== transaction.type || draft.amount !== transaction.amount || draft.transactionDate !== transaction.transactionDate) return false;
  const party = normaliseDuplicateText(draft.merchantOrCustomer);
  const candidateParty = normaliseDuplicateText(transaction.merchantOrCustomer);
  if (party && candidateParty && party === candidateParty) return true;
  const description = normaliseDuplicateText(draft.description);
  const candidateDescription = normaliseDuplicateText(transaction.description);
  return Boolean(description && description === candidateDescription) || descriptionSimilarity(draft.description, transaction.description) >= 0.7;
}

export function findLikelyDuplicate(draft: TransactionDraft, recentTransactions: readonly ConfirmedTransaction[]): ConfirmedTransaction | null {
  return recentTransactions.find((transaction) => isLikelyDuplicate(draft, transaction)) ?? null;
}
