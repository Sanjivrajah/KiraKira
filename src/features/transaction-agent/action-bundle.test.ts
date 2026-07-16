import { describe, expect, it } from "vitest";
import { ActionBundleConfirmationService, type ActionBundle } from "./action-bundle";
import type { TransactionDraft } from "./transaction-record.schema";

const draft = (id: string): TransactionDraft => ({ id, telegramUserId: "user", telegramChatId: "chat", type: "income", amount: 20, currency: "MYR", description: "Sale", merchantOrCustomer: null, paymentMethod: "cash", transactionDate: "2026-07-16", category: null, quantity: null, unit: null, missingFields: [], confidence: 0.9, sourceType: "telegram_text", originalInput: "sold", status: "pending", createdAt: "2026-07-16T00:00:00.000Z", updatedAt: "2026-07-16T00:00:00.000Z" });
const ids = ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"];
const bundle: ActionBundle = { id: "00000000-0000-4000-8000-000000000010", telegramUserId: "user", telegramChatId: "chat", sourceMessageId: "message", draftIds: ids, status: "awaiting_confirmation", createdAt: "2026-07-16T00:00:00.000Z", updatedAt: "2026-07-16T00:00:00.000Z" };

describe("ActionBundleConfirmationService", () => {
  it("revalidates every action before confirming any", async () => {
    const first = draft(ids[0]); const second: TransactionDraft = { ...draft(ids[1]), amount: null, missingFields: ["amount"] };
    const service = new ActionBundleConfirmationService({ findById: async (id) => id === first.id ? first : second }, { act: async () => { throw new Error("must not execute"); } } as never);
    await expect(service.confirmAll(bundle, "user", "chat")).resolves.toMatchObject({ outcome: "incomplete", missing: [{ draftId: second.id }] });
  });

  it("reports an explicit partial failure rather than claiming all actions were saved", async () => {
    const records = new Map(ids.map((id) => [id, draft(id)])); let calls = 0;
    const service = new ActionBundleConfirmationService({ findById: async (id) => records.get(id) ?? null }, { act: async () => {
      calls += 1;
      if (calls === 2) throw new Error("disk unavailable");
      return { outcome: "confirmed", transaction: {} };
    } } as never);
    await expect(service.confirmAll(bundle, "user", "chat")).resolves.toEqual({ outcome: "partial_failure", confirmedDraftIds: [ids[0]], failedDraftId: ids[1] });
  });
});
