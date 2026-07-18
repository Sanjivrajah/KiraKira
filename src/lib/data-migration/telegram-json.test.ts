import { describe, expect, it } from "vitest";
import { previewTelegramJson } from "./telegram-json";

const record = { id: "dfe0dce5-6acb-4ee4-8d3c-a76d33462e1d", telegramUserId: "10", telegramChatId: "20", sourceType: "telegram_text", originalInput: "sold coffee", type: "income", amount: 10, currency: "MYR", description: "Coffee", merchantOrCustomer: null, category: "sales", transactionDate: "2026-07-01", paymentMethod: "cash", quantity: null, unit: null, confidence: 1, missingFields: [], status: "confirmed", createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z", confirmedAt: "2026-07-01T00:00:00.000Z" };

describe("Telegram JSON migration", () => {
  it("requires an explicit user/chat to account mapping", () => {
    const result = previewTelegramJson([record], [{ telegramUserId: "10", telegramChatId: "20", telegramAccountId: "d0e6f72d-0f10-4c37-a4e7-7b4fd3e2bfae" }]);
    expect(result.report).toEqual([{ index: 0, transactionId: record.id, status: "ready" }]);
    expect(() => previewTelegramJson([record], [])).toThrow();
  });
});
