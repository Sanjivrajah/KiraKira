import { describe, expect, it } from "vitest";
import { MAX_TEXT_MESSAGE_LENGTH } from "@/features/transaction-agent/agent-config";
import { findLikelyDuplicate, isLikelyDuplicate, normaliseDuplicateText } from "@/features/transaction-agent/duplicate-detector";
import { formatMyr, formatRecentTransactions, formatTransactionSummary } from "@/features/transaction-agent/telegram-command-formatters";
import type { ConfirmedTransaction, TransactionDraft } from "@/features/transaction-agent/transaction-record.schema";

const transaction: ConfirmedTransaction = {
  id: "00000000-0000-4000-8000-000000000001", telegramUserId: "owner", telegramChatId: "chat", sourceType: "telegram_text", originalInput: "beli ayam",
  type: "expense", amount: 85, currency: "MYR", description: "Purchase of chicken", merchantOrCustomer: "Pasar Borong", paymentMethod: "cash", transactionDate: "2026-07-15", category: null, quantity: null, unit: null, confidence: 0.9, status: "confirmed", createdAt: "2026-07-15T00:00:00.000Z", updatedAt: "2026-07-15T00:00:00.000Z", confirmedAt: "2026-07-15T00:00:00.000Z",
};
const draft: TransactionDraft = { ...transaction, status: "pending", missingFields: [] };

describe("Session 6 command formatting", () => {
  it("shows an empty state and formats MYR amounts", () => {
    expect(formatRecentTransactions([])).toContain("no confirmed transactions");
    expect(formatMyr(85)).toBe("RM 85.00");
  });

  it("renders only supplied records newest first and never exposes IDs", () => {
    const latest = { ...transaction, id: "00000000-0000-4000-8000-000000000002", description: "Latest expense", transactionDate: "2026-07-16" };
    const rendered = formatRecentTransactions([latest, transaction], 11);
    expect(rendered.indexOf("Latest expense")).toBeLessThan(rendered.indexOf("Purchase of chicken"));
    expect(rendered).toContain("Showing the latest 2 transactions of 11.");
    expect(rendered).not.toContain(transaction.id);
  });

  it("calculates customer payments separately from income with decimals", () => {
    const rendered = formatTransactionSummary([
      { ...transaction, type: "income", amount: 1250.5 },
      { ...transaction, id: "00000000-0000-4000-8000-000000000003", type: "customer_payment", amount: 450.25 },
      { ...transaction, id: "00000000-0000-4000-8000-000000000004", type: "expense", amount: 620.75 },
    ]);
    expect(rendered).toContain("Income: RM 1,250.50");
    expect(rendered).toContain("Customer payments: RM 450.25");
    expect(rendered).toContain("Expenses: RM 620.75");
    expect(rendered).toContain("Net cash movement: RM 1,080.00");
    expect(formatTransactionSummary([])).toContain("Transactions recorded: 0");
  });
});

describe("deterministic duplicate detection", () => {
  it("matches exact and normalised duplicate details", () => {
    expect(normaliseDuplicateText("  Purchase, of the CHICKEN!! ")).toBe("purchase chicken");
    expect(isLikelyDuplicate(draft, transaction)).toBe(true);
    expect(findLikelyDuplicate(draft, [transaction])).toEqual(transaction);
  });

  it("does not match different dates or amounts", () => {
    expect(isLikelyDuplicate({ ...draft, transactionDate: "2026-07-14" }, transaction)).toBe(false);
    expect(isLikelyDuplicate({ ...draft, amount: 86 }, transaction)).toBe(false);
  });

  it("matches similar descriptions with the same merchant but does not merge anything", () => {
    expect(isLikelyDuplicate({ ...draft, description: "Chicken purchase!!!", merchantOrCustomer: "pasar borong" }, transaction)).toBe(true);
    expect(transaction.status).toBe("confirmed");
  });
});

describe("hardening configuration", () => {
  it("has a finite central text limit", () => {
    expect(MAX_TEXT_MESSAGE_LENGTH).toBeGreaterThan(0);
    expect("x".repeat(MAX_TEXT_MESSAGE_LENGTH + 1)).toHaveLength(MAX_TEXT_MESSAGE_LENGTH + 1);
  });
});
