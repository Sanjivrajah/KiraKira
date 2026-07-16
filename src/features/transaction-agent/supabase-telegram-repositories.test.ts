import { describe, expect, it } from "vitest";
import { toSupabaseConfirmedTransactionPayload } from "./supabase-telegram-repositories";

describe("Supabase Telegram confirmation payload", () => {
  it("uses a safe category code when a reviewed draft has no model category", () => {
    const payload = toSupabaseConfirmedTransactionPayload({ id: "00000000-0000-4000-8000-000000000001", telegramUserId: "owner", telegramChatId: "chat", type: "expense", amount: 30, currency: "MYR", description: "nasi lemak", merchantOrCustomer: "Malik Enterprise", paymentMethod: "bank_transfer", transactionDate: "2026-07-16", category: null, quantity: null, unit: null, confidence: 0.9, sourceType: "telegram_text", originalInput: "Bought nasi lemak RM30", status: "confirmed", createdAt: "2026-07-17T00:00:00.000Z", updatedAt: "2026-07-17T00:00:00.000Z", confirmedAt: "2026-07-17T00:00:00.000Z" });
    expect(payload).toMatchObject({ category: "uncategorized", direction: "expense", transactionType: "expense", amountMinor: 3000 });
  });
});
