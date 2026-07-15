import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { TransactionDraftService, getConfirmationMissingFields } from "@/features/transaction-agent/transaction-confirmation";
import { createLocalTransactionRepositories } from "@/features/transaction-agent/transaction-repositories";
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
});
