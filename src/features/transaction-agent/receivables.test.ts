import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalReceivableRepository, ReceivableService, draftReminder, findCustomerMatches, isOverdue, outstandingReceivables } from "./receivables";

const directories: string[] = [];
async function service() { const directory = await mkdtemp(join(tmpdir(), "niagaai-receivables-")); directories.push(directory); const repository = new LocalReceivableRepository(directory); return { repository, service: new ReceivableService(repository, () => new Date("2026-07-17T00:00:00.000Z")) }; }
afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

describe("receivable lifecycle", () => {
  it("creates a MYR receivable and reconciles partial then full payment", async () => {
    const { service: subject } = await service(); const receivable = await subject.create({ telegramUserId: "owner", telegramChatId: "chat", customerDisplayName: "Ali", amount: 40, issuedOn: "2026-07-16", dueOn: "2026-07-18" });
    await expect(subject.recordPayment({ receivableId: receivable.id, telegramUserId: "owner", telegramChatId: "chat", amount: 20, paidOn: "2026-07-17", paymentMethod: "cash", idempotencyKey: "payment-1" })).resolves.toMatchObject({ outcome: "recorded", receivable: { status: "partially_paid", outstandingAmount: 20 } });
    await expect(subject.recordPayment({ receivableId: receivable.id, telegramUserId: "owner", telegramChatId: "chat", amount: 20, paidOn: "2026-07-17", paymentMethod: "cash", idempotencyKey: "payment-2" })).resolves.toMatchObject({ outcome: "recorded", receivable: { status: "paid", outstandingAmount: 0 } });
  });
  it("rejects overpayments and duplicate payment deliveries", async () => {
    const { service: subject } = await service(); const receivable = await subject.create({ telegramUserId: "owner", telegramChatId: "chat", customerDisplayName: "Ali", amount: 40, issuedOn: "2026-07-16" });
    await expect(subject.recordPayment({ receivableId: receivable.id, telegramUserId: "owner", telegramChatId: "chat", amount: 41, paidOn: "2026-07-17", paymentMethod: "cash", idempotencyKey: "too-much" })).resolves.toMatchObject({ outcome: "overpayment", outstandingAmount: 40 });
    const first = await subject.recordPayment({ receivableId: receivable.id, telegramUserId: "owner", telegramChatId: "chat", amount: 10, paidOn: "2026-07-17", paymentMethod: "cash", idempotencyKey: "telegram:99" });
    const retry = await subject.recordPayment({ receivableId: receivable.id, telegramUserId: "owner", telegramChatId: "chat", amount: 10, paidOn: "2026-07-17", paymentMethod: "cash", idempotencyKey: "telegram:99" });
    expect(first).toMatchObject({ outcome: "recorded" }); expect(retry).toMatchObject({ outcome: "duplicate" });
  });
  it("keeps owner data isolated and excludes voided records", async () => {
    const { service: subject, repository } = await service(); const ali = await subject.create({ telegramUserId: "owner", telegramChatId: "chat", customerDisplayName: "Ali", amount: 40, issuedOn: "2026-07-16", dueOn: "2026-07-16" });
    const alice = await subject.create({ telegramUserId: "other", telegramChatId: "chat", customerDisplayName: "Alice", amount: 50, issuedOn: "2026-07-16" });
    await expect(subject.recordPayment({ receivableId: ali.id, telegramUserId: "other", telegramChatId: "chat", amount: 1, paidOn: "2026-07-17", paymentMethod: "cash", idempotencyKey: "foreign" })).resolves.toMatchObject({ outcome: "not_owner" });
    expect(findCustomerMatches(await repository.listByOwner("owner", "chat"), "ali")).toHaveLength(1);
    expect(isOverdue(ali, "2026-07-17")).toBe(true); expect(draftReminder(ali, "2026-07-17")).toContain("RM40.00");
    await subject.void({ receivableId: ali.id, telegramUserId: "owner", telegramChatId: "chat", reason: "Entered in error" });
    expect(outstandingReceivables(await repository.listByOwner("owner", "chat"), "2026-07-17")).toEqual([]);
    expect(await repository.listByOwner("owner", "chat")).not.toContainEqual(alice);
  });
});
