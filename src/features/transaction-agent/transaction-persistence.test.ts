import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { TransactionDraftService, getConfirmationMissingFields } from "@/features/transaction-agent/transaction-confirmation";
import { createLocalTransactionRepositories } from "@/features/transaction-agent/transaction-repositories";
import type { DraftRepository } from "@/features/transaction-agent/transaction-repositories";
import { JsonArrayStore, LocalJsonStoreError } from "@/lib/storage/json-store";
import type { TransactionExtraction } from "@/features/transaction-agent/transaction.schema";

const directories: string[] = [];
async function makeDirectory() { const directory = await mkdtemp(join(tmpdir(), "niagaai-transaction-agent-")); directories.push(directory); return directory; }
afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

const completeExtraction: TransactionExtraction = {
  type: "expense", amount: 85, currency: "MYR", description: "Purchase of chicken", merchantOrCustomer: "Pasar Borong",
  paymentMethod: "cash", transactionDate: "2026-07-14", category: "Raw materials", quantity: null, unit: null, missingFields: [], confidence: 0.94,
};

async function makeService() {
  const directory = await makeDirectory();
  const repositories = createLocalTransactionRepositories(directory);
  return { directory, repositories, service: new TransactionDraftService(repositories.drafts, repositories.transactions, () => new Date("2026-07-15T00:00:00.000Z")) };
}

describe("local JSON transaction persistence", () => {
  it("creates missing data files as empty JSON arrays and reads an empty store", async () => {
    const directory = await makeDirectory();
    const repositories = createLocalTransactionRepositories(directory);
    await Promise.all([repositories.drafts.ensure(), repositories.transactions.ensure()]);
    await expect(readFile(join(directory, "transaction-drafts.json"), "utf8")).resolves.toBe("[]\n");
    await expect(readFile(join(directory, "transactions.json"), "utf8")).resolves.toBe("[]\n");
    await expect(repositories.transactions.listByUser("user-1")).resolves.toEqual([]);
  });

  it("writes drafts, reads them back, and updates their status", async () => {
    const { repositories, service } = await makeService();
    const draft = await service.createDraft({ extraction: completeExtraction, telegramUserId: "user-1", telegramChatId: "chat-1", originalInput: "beli ayam" });
    expect(await repositories.drafts.findById(draft.id)).toMatchObject({ status: "pending", originalInput: "beli ayam" });
    await repositories.drafts.update({ ...draft, status: "cancelled", updatedAt: "2026-07-15T01:00:00.000Z" });
    await expect(repositories.drafts.findById(draft.id)).resolves.toMatchObject({ status: "cancelled" });
  });

  it("saves a valid confirmed transaction and marks its draft confirmed", async () => {
    const { repositories, service } = await makeService();
    const draft = await service.createDraft({ extraction: completeExtraction, telegramUserId: "user-1", telegramChatId: "chat-1", originalInput: "beli ayam" });
    await expect(service.act({ action: "confirm", draftId: draft.id, telegramUserId: "user-1" })).resolves.toMatchObject({ outcome: "confirmed" });
    await expect(repositories.transactions.listByUser("user-1")).resolves.toMatchObject([{ id: draft.id, status: "confirmed", confirmedAt: "2026-07-15T00:00:00.000Z" }]);
    await expect(repositories.drafts.findById(draft.id)).resolves.toMatchObject({ status: "confirmed" });
  });

  it("serialises repeated confirmation presses so only one transaction is saved", async () => {
    const { repositories, service } = await makeService();
    const draft = await service.createDraft({ extraction: completeExtraction, telegramUserId: "user-1", telegramChatId: "chat-1", originalInput: "beli ayam" });

    const results = await Promise.all([
      service.act({ action: "confirm", draftId: draft.id, telegramUserId: "user-1" }),
      service.act({ action: "confirm", draftId: draft.id, telegramUserId: "user-1" }),
    ]);

    expect(results.map((result) => result.outcome).sort()).toEqual(["confirmed", "expired"]);
    await expect(repositories.transactions.listByUser("user-1")).resolves.toHaveLength(1);
  });

  it("recovers idempotently if the transaction write succeeds before the draft update fails", async () => {
    const directory = await makeDirectory();
    const repositories = createLocalTransactionRepositories(directory);
    let failNextConfirmedUpdate = true;
    const flakyDrafts: DraftRepository = {
      ensure: () => repositories.drafts.ensure(),
      create: (draft) => repositories.drafts.create(draft),
      findById: (id) => repositories.drafts.findById(id),
      update: (draft) => {
        if (draft.status === "confirmed" && failNextConfirmedUpdate) {
          failNextConfirmedUpdate = false;
          return Promise.reject(new Error("Simulated draft write failure."));
        }
        return repositories.drafts.update(draft);
      },
    };
    const service = new TransactionDraftService(flakyDrafts, repositories.transactions, () => new Date("2026-07-15T00:00:00.000Z"));
    const draft = await service.createDraft({ extraction: completeExtraction, telegramUserId: "user-1", telegramChatId: "chat-1", originalInput: "beli ayam" });

    await expect(service.act({ action: "confirm", draftId: draft.id, telegramUserId: "user-1" })).rejects.toThrow("Simulated draft write failure.");
    await expect(repositories.transactions.listByUser("user-1")).resolves.toHaveLength(1);
    await expect(service.act({ action: "confirm", draftId: draft.id, telegramUserId: "user-1" })).resolves.toMatchObject({ outcome: "confirmed" });
    await expect(repositories.transactions.listByUser("user-1")).resolves.toHaveLength(1);
    await expect(repositories.drafts.findById(draft.id)).resolves.toMatchObject({ status: "confirmed" });
  });

  it("voids a recent confirmation once, keeps audit evidence, and enforces ownership and expiry", async () => {
    const directory = await makeDirectory();
    const repositories = createLocalTransactionRepositories(directory);
    let current = new Date("2026-07-15T00:00:00.000Z");
    const service = new TransactionDraftService(repositories.drafts, repositories.transactions, () => current);
    const draft = await service.createDraft({ extraction: completeExtraction, telegramUserId: "owner", telegramChatId: "chat", originalInput: "beli ayam" });
    await service.act({ action: "confirm", draftId: draft.id, telegramUserId: "owner" });
    await expect(service.undo({ transactionId: draft.id, telegramUserId: "other", telegramChatId: "chat" })).resolves.toBe("not_owner");
    const undoResults = await Promise.all([service.undo({ transactionId: draft.id, telegramUserId: "owner", telegramChatId: "chat" }), service.undo({ transactionId: draft.id, telegramUserId: "owner", telegramChatId: "chat" })]);
    expect(undoResults.sort()).toEqual(["already_voided", "voided"]);
    await expect(repositories.transactions.findById(draft.id)).resolves.toMatchObject({ status: "voided", voidedAt: "2026-07-15T00:00:00.000Z" });
    await expect(repositories.transactions.findRecentByUser("owner", 10)).resolves.toEqual([]);

    const oldDraft = await service.createDraft({ extraction: { ...completeExtraction, description: "Old expense" }, telegramUserId: "owner", telegramChatId: "chat", originalInput: "old" });
    await service.act({ action: "confirm", draftId: oldDraft.id, telegramUserId: "owner" });
    current = new Date("2026-07-15T00:05:00.001Z");
    await expect(service.undo({ transactionId: oldDraft.id, telegramUserId: "owner", telegramChatId: "chat" })).resolves.toBe("expired");
  });

  it("reads transactions written by the pre-Stage-1 JSON schema", async () => {
    const directory = await makeDirectory();
    const legacy = { ...completeExtraction, id: "00000000-0000-4000-8000-000000000000", telegramUserId: "owner", telegramChatId: "chat", sourceType: "telegram_text", originalInput: "legacy", status: "confirmed", createdAt: "2026-07-15T00:00:00.000Z", updatedAt: "2026-07-15T00:00:00.000Z", confirmedAt: "2026-07-15T00:00:00.000Z" };
    const stored = { ...legacy, missingFields: undefined };
    await writeFile(join(directory, "transactions.json"), `${JSON.stringify([stored])}\n`, "utf8");
    await expect(createLocalTransactionRepositories(directory).transactions.listByUser("owner")).resolves.toMatchObject([{ status: "confirmed" }]);
  });

  it("rejects malformed JSON safely", async () => {
    const directory = await makeDirectory();
    const filePath = join(directory, "broken.json");
    await writeFile(filePath, "not json", "utf8");
    await expect(new JsonArrayStore<unknown>(filePath).read()).rejects.toBeInstanceOf(LocalJsonStoreError);
  });

  it("lists all remaining confirmation requirements and rejects incomplete drafts", async () => {
    const incomplete: TransactionExtraction = { ...completeExtraction, description: "", paymentMethod: "unknown", transactionDate: null, missingFields: ["purpose", "transactionDate", "paymentMethod"] };
    expect(getConfirmationMissingFields(incomplete)).toEqual(expect.arrayContaining(["description/purpose", "transaction date", "payment method"]));
    const { repositories, service } = await makeService();
    const draft = await service.createDraft({ extraction: incomplete, telegramUserId: "user-1", telegramChatId: "chat-1", originalInput: "Paid supplier Ali RM300" });
    await expect(service.act({ action: "confirm", draftId: draft.id, telegramUserId: "user-1" })).resolves.toMatchObject({ outcome: "incomplete" });
    await expect(repositories.transactions.listByUser("user-1")).resolves.toEqual([]);
  });

  it("handles expired callbacks and ownership checks without changing records", async () => {
    const { repositories, service } = await makeService();
    const draft = await service.createDraft({ extraction: completeExtraction, telegramUserId: "owner", telegramChatId: "chat-1", originalInput: "beli ayam" });
    await expect(service.act({ action: "cancel", draftId: draft.id, telegramUserId: "other" })).resolves.toEqual({ outcome: "not_owner" });
    await expect(service.act({ action: "cancel", draftId: "00000000-0000-4000-8000-000000000000", telegramUserId: "owner" })).resolves.toEqual({ outcome: "missing" });
    await service.act({ action: "cancel", draftId: draft.id, telegramUserId: "owner" });
    await expect(service.act({ action: "confirm", draftId: draft.id, telegramUserId: "owner" })).resolves.toEqual({ outcome: "expired" });
    await expect(repositories.transactions.listByUser("owner")).resolves.toEqual([]);
  });

  it("requires draft ownership and a still-matching duplicate before Save Anyway", async () => {
    const { repositories, service } = await makeService();
    const first = await service.createDraft({ extraction: completeExtraction, telegramUserId: "owner", telegramChatId: "chat-1", originalInput: "beli ayam pertama" });
    await service.act({ action: "confirm", draftId: first.id, telegramUserId: "owner" });
    const repeated = await service.createDraft({ extraction: completeExtraction, telegramUserId: "owner", telegramChatId: "chat-1", originalInput: "beli ayam lagi" });
    const warning = await service.act({ action: "confirm", draftId: repeated.id, telegramUserId: "owner" });
    expect(warning).toMatchObject({ outcome: "duplicate", transaction: { id: first.id } });
    await expect(service.act({ action: "save_anyway", draftId: repeated.id, telegramUserId: "other" })).resolves.toEqual({ outcome: "not_owner" });
    await expect(service.act({ action: "save_anyway", draftId: repeated.id, telegramUserId: "owner" })).resolves.toMatchObject({ outcome: "confirmed" });
    expect(await repositories.transactions.listByUser("owner")).toHaveLength(2);
  });

  it("returns recent confirmed transactions newest first, scoped to the Telegram user", async () => {
    const { repositories, service } = await makeService();
    const older = await service.createDraft({ extraction: { ...completeExtraction, transactionDate: "2026-07-01" }, telegramUserId: "owner", telegramChatId: "chat", originalInput: "old" });
    const newer = await service.createDraft({ extraction: { ...completeExtraction, transactionDate: "2026-07-15" }, telegramUserId: "owner", telegramChatId: "chat", originalInput: "new" });
    const other = await service.createDraft({ extraction: completeExtraction, telegramUserId: "other", telegramChatId: "chat", originalInput: "other" });
    await service.act({ action: "confirm", draftId: older.id, telegramUserId: "owner" });
    await service.act({ action: "confirm", draftId: newer.id, telegramUserId: "owner" });
    await service.act({ action: "confirm", draftId: other.id, telegramUserId: "other" });
    await expect(repositories.transactions.findRecentByUser("owner", 1)).resolves.toMatchObject([{ id: newer.id }]);
    await expect(repositories.transactions.findRecentByUser("owner", 10)).resolves.toHaveLength(2);
  });

  it("caps recent results at the requested maximum", async () => {
    const { repositories, service } = await makeService();
    for (let index = 0; index < 11; index += 1) {
      const created = await service.createDraft({ extraction: { ...completeExtraction, transactionDate: `2026-07-${String(index + 1).padStart(2, "0")}`, description: `Expense ${index}` }, telegramUserId: "owner", telegramChatId: "chat", originalInput: `expense ${index}` });
      await service.act({ action: "confirm", draftId: created.id, telegramUserId: "owner" });
    }
    const recent = await repositories.transactions.findRecentByUser("owner", 10);
    expect(recent).toHaveLength(10);
    expect(recent[0]?.description).toBe("Expense 10");
  });
});
