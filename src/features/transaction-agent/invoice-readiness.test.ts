import { describe, expect, it } from "vitest";
import {
  UBL_FIXTURE_BUSINESS,
  UBL_FIXTURE_BUYER,
  UBL_FIXTURE_SUPPLIER,
  UBL_STANDARD_B2B_INVOICE,
} from "@/compliance/myinvois";
import { evaluateInvoiceReadiness, InvoiceReadinessService, resolveInvoicePreparationIntent, type InvoiceReadinessDraft, type InvoiceReadinessRepository } from "./invoice-readiness";

const now = () => new Date("2026-07-17T00:00:00.000Z");
const base = () => ({
  telegramUserId: "owner", telegramChatId: "chat", sourceTransactionId: "tx-1",
  document: UBL_STANDARD_B2B_INVOICE, supplier: UBL_FIXTURE_SUPPLIER, buyer: UBL_FIXTURE_BUYER,
  business: UBL_FIXTURE_BUSINESS, scenario: "b2b_invoice" as const,
});
class MemoryRepository implements InvoiceReadinessRepository {
  values: InvoiceReadinessDraft[] = [];
  async create(draft: InvoiceReadinessDraft) { this.values.push(draft); return draft; }
  async update(draft: InvoiceReadinessDraft) { this.values[this.values.findIndex((item) => item.id === draft.id)] = draft; return draft; }
  async findById(id: string) { return this.values.find((item) => item.id === id) ?? null; }
  async findBySourceTransaction(id: string) { return this.values.find((item) => item.sourceTransactionId === id) ?? null; }
}

describe("invoice readiness specialist", () => {
  it("assesses a fully ready canonical invoice draft", () => expect(evaluateInvoiceReadiness(base()).ready).toBe(true));
  it("reports a missing buyer identifier", () => {
    const buyer = { ...UBL_FIXTURE_BUYER, taxIdentifiers: [] };
    expect(evaluateInvoiceReadiness({ ...base(), buyer }).missingRequiredFields.map((item) => item.fieldPath)).toContain("buyer.taxIdentifiers");
  });
  it("reports conditional tax and foreign-currency fields", () => {
    const document = { ...UBL_STANDARD_B2B_INVOICE, currency: "SGD" as const, exchangeRate: undefined };
    expect(evaluateInvoiceReadiness({ ...base(), document }).conditionalFields.map((item) => item.ruleId)).toContain("document.exchange-rate.required");
  });
  it("treats an invalid issue date as a canonical draft correction", () => {
    const document = { ...UBL_STANDARD_B2B_INVOICE, issueDate: "2026-99-99" };
    expect(evaluateInvoiceReadiness({ ...base(), document }).invalidFields.map((item) => item.ruleId)).toContain("canonical.schema.valid");
  });
  it("surfaces canonical line total mismatches as invalid input", () => {
    const document = { ...UBL_STANDARD_B2B_INVOICE, lines: [{ ...UBL_STANDARD_B2B_INVOICE.lines[0], totals: { ...UBL_STANDARD_B2B_INVOICE.lines[0].totals, taxAmount: { amount: "1", currency: "MYR" as const } } }] };
    expect(evaluateInvoiceReadiness({ ...base(), document }).invalidFields.map((item) => item.ruleId)).toContain("canonical.schema.valid");
  });
  it("recognizes ambiguous source transaction matches", () => {
    expect(resolveInvoicePreparationIntent("Create invoice for Siti", [{ id: "a", label: "Siti catering" }, { id: "b", label: "Siti delivery" }]).matches).toHaveLength(2);
  });
  it("does not create another draft for an attached transaction and keeps approvals idempotent", async () => {
    const repository = new MemoryRepository(); const service = new InvoiceReadinessService(repository, now);
    const first = await service.prepare(base());
    expect(first.outcome).toBe("prepared");
    const second = await service.prepare(base());
    expect(second.outcome).toBe("already_attached");
    if (first.outcome !== "prepared") throw new Error("Expected draft");
    expect((await service.approve(first.draft.id, "other", "chat")).outcome).toBe("not_found");
    expect((await service.approve(first.draft.id, "owner", "chat")).outcome).toBe("approved");
    expect((await service.approve(first.draft.id, "owner", "chat")).outcome).toBe("already_approved");
    const correction = await service.correct(first.draft.id, "owner", "chat", { document: UBL_STANDARD_B2B_INVOICE, supplier: UBL_FIXTURE_SUPPLIER, buyer: { ...UBL_FIXTURE_BUYER, taxIdentifiers: [] }, business: UBL_FIXTURE_BUSINESS, scenario: "b2b_invoice" });
    expect(correction.outcome).toBe("corrected");
    if (correction.outcome !== "corrected") throw new Error("Expected correction");
    expect(correction.draft.lifecycle).toBe("needs_information");
  });
  it("does not create a draft for an unsupported document type", async () => {
    const service = new InvoiceReadinessService(new MemoryRepository(), now);
    expect((await service.prepare({ ...base(), document: { ...UBL_STANDARD_B2B_INVOICE, documentType: "credit_note" } })).outcome).toBe("unsupported_transaction_type");
    expect("submit" in service).toBe(false);
  });
});
