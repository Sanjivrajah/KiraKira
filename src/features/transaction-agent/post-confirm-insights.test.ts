import { describe, expect, it } from "vitest";
import { buildPostConfirmInsight } from "@/features/transaction-agent/post-confirm-insights";
import type { ConfirmedTransaction } from "@/features/transaction-agent/transaction-record.schema";

const tx = (overrides: Partial<ConfirmedTransaction>): ConfirmedTransaction => ({
  id: "00000000-0000-4000-8000-000000000000", telegramUserId: "user", telegramChatId: "chat",
  type: "income", amount: 25, currency: "MYR", description: "Sale of nasi lemak", merchantOrCustomer: "Ahmad",
  paymentMethod: "cash", transactionDate: "2026-07-18", category: "Sales revenue", quantity: null, unit: null,
  sourceType: "telegram_text", originalInput: "sold nasi lemak", status: "confirmed", confirmedAt: "2026-07-18T02:00:00.000Z",
  createdAt: "2026-07-18T02:00:00.000Z", updatedAt: "2026-07-18T02:00:00.000Z", schemaVersion: 2, ...overrides,
} as ConfirmedTransaction);

describe("post-confirm insight", () => {
  it("celebrates a repeat customer on the same day", () => {
    const confirmed = tx({ id: "a" });
    const recent = [confirmed, tx({ id: "b" }), tx({ id: "c", transactionDate: "2026-07-17" })];
    expect(buildPostConfirmInsight(confirmed, recent)).toBe("📌 That's your 2nd transaction with Ahmad today.");
  });

  it("ignores voided records when counting", () => {
    const confirmed = tx({ id: "a" });
    const recent = [confirmed, tx({ id: "b", status: "voided" })];
    expect(buildPostConfirmInsight(confirmed, recent)).toBeNull();
  });

  it("reports a running category total for the month when there is no same-day party pattern", () => {
    const confirmed = tx({ id: "a", type: "expense", category: "Raw materials", amount: 85, merchantOrCustomer: null });
    const recent = [
      confirmed,
      tx({ id: "b", type: "expense", category: "Raw materials", amount: 40, merchantOrCustomer: null, transactionDate: "2026-07-10" }),
      tx({ id: "c", type: "expense", category: "Raw materials", amount: 100, merchantOrCustomer: null, transactionDate: "2026-06-30" }),
    ];
    // Only July entries (85 + 40) count toward this month's total.
    const insight = buildPostConfirmInsight(confirmed, recent);
    expect(insight).toContain("125.00");
    expect(insight).toContain('across 2 "Raw materials" entries');
  });

  it("returns null when nothing notable applies", () => {
    const confirmed = tx({ id: "a", merchantOrCustomer: null, category: null });
    expect(buildPostConfirmInsight(confirmed, [confirmed])).toBeNull();
  });

  it("localises to Bahasa Melayu", () => {
    const confirmed = tx({ id: "a" });
    const recent = [confirmed, tx({ id: "b" })];
    expect(buildPostConfirmInsight(confirmed, recent, "ms")).toContain("transaksi ke-2 dengan Ahmad");
  });
});
