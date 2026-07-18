import { describe, expect, it, vi } from "vitest";
import { DEMO_TRANSACTIONS } from "@/data/demo";
import { toDomainTransaction } from "@/frontend/view-models/transaction-adapter";
import { LegacyTransactionRepositoryAdapter } from "./legacy-transaction-repository-adapter";
import { SupabaseTransactionRepository } from "./transaction-repository";

describe("Supabase transaction repository", () => {
  it("maps an explicitly selected database row into the canonical domain model", () => {
    const transaction = toDomainTransaction(DEMO_TRANSACTIONS[0]);
    const result = new SupabaseTransactionRepository().mapFromDatabase({
      id: transaction.id,
      business_id: transaction.businessId,
      direction: transaction.direction,
      lifecycle: transaction.lifecycle,
      transaction_date: transaction.transactionDate,
      accounting_date: transaction.accountingDate,
      counterparty_id: transaction.counterpartyId ?? null,
      counterparty_name_snapshot: transaction.counterpartyNameSnapshot ?? null,
      source_links: transaction.sourceLinks,
      description: transaction.description,
      category_code: transaction.categoryCode,
      currency: transaction.currency,
      exchange_rate_to_myr: 1,
      subtotal_minor: 48000,
      discount_minor: 0,
      tax_minor: 0,
      total_minor: 48000,
      lines: transaction.lines,
      totals: transaction.totals,
      payment_status: transaction.paymentStatus,
      payment_method_code: transaction.paymentMethodCode ?? null,
      e_invoice_treatment: transaction.eInvoiceTreatment,
      confidence_score: transaction.confidenceScore ?? null,
      confirmation: transaction.confirmation ?? null,
      void_metadata: transaction.voidMetadata ?? null,
      confirmed_at: transaction.confirmation?.confirmedAt ?? null,
      confirmed_by: transaction.confirmation?.confirmedBy ?? null,
      voided_at: transaction.voidMetadata?.voidedAt ?? null,
      voided_by: transaction.voidMetadata?.voidedBy ?? null,
      void_reason: transaction.voidMetadata?.reason ?? null,
      created_at: transaction.createdAt,
      updated_at: transaction.updatedAt,
      created_by: transaction.createdBy ?? null,
      updated_by: transaction.updatedBy ?? null,
      version: transaction.version ?? 0,
    });
    expect(result).toMatchObject({ id: transaction.id, businessId: transaction.businessId, totals: transaction.totals });
  });

  it("maps a confirmed Telegram row without canonical line or totals JSON for the dashboard", () => {
    const result = new SupabaseTransactionRepository().mapFromDatabase({
      id: "0a702ac7-f0ec-40fa-9a7e-02f00c0e40b1", business_id: "eba2eef6-4b30-4e65-85c8-6e3bacc97d02", direction: "expense", lifecycle: "confirmed", transaction_date: "2026-07-17", accounting_date: "2026-07-17", counterparty_id: null, counterparty_name_snapshot: "Malik Enterprise", source_links: [], description: "nasi lemak", category_code: "uncategorized", currency: "MYR", exchange_rate_to_myr: null, subtotal_minor: 3000, discount_minor: 0, tax_minor: 0, total_minor: 3000, lines: [], totals: {}, payment_status: "not_applicable", payment_method_code: "bank_transfer", e_invoice_treatment: "undetermined", confidence_score: null, confirmation: { telegram: true }, void_metadata: null, confirmed_at: "2026-07-17T01:47:00+00:00", confirmed_by: "9c6c7229-7a5c-48d6-99cf-ec1feecd058c", voided_at: null, voided_by: null, void_reason: null, created_at: "2026-07-17T01:47:00+00:00", updated_at: "2026-07-17T01:47:00+00:00", created_by: "9c6c7229-7a5c-48d6-99cf-ec1feecd058c", updated_by: "9c6c7229-7a5c-48d6-99cf-ec1feecd058c", version: 0,
    });
    expect(result).toMatchObject({ lifecycle: "confirmed", description: "nasi lemak", totals: { payableAmount: { amount: "30.00" } }, confirmation: { confirmedAt: "2026-07-17T01:47:00.000Z" } });
  });

  it("writes canonical totals to normalized database minor-unit columns", () => {
    const transaction = toDomainTransaction(DEMO_TRANSACTIONS[0]);
    const row = new SupabaseTransactionRepository().mapToDatabase(transaction);
    expect(row).toMatchObject({
      subtotal_minor: 48000,
      discount_minor: 0,
      tax_minor: 0,
      total_minor: 48000,
    });
  });

  it("voids financial records instead of issuing a hard delete", async () => {
    const voidTransaction = vi.fn().mockResolvedValue(toDomainTransaction(DEMO_TRANSACTIONS[0]));
    const adapter = new LegacyTransactionRepositoryAdapter({ void: voidTransaction } as never);
    await adapter.remove({ businessId: "business_demo", transactionId: "txn_001" });
    expect(voidTransaction).toHaveBeenCalledWith("business_demo", "txn_001", "Voided from the web application");
  });

  it("lets PostgreSQL generate the database UUID instead of relying on browser crypto", async () => {
    const create = vi.fn().mockImplementation(async (transaction) => ({ ...transaction, id: "0a702ac7-f0ec-40fa-9a7e-02f00c0e40b1" }));
    const adapter = new LegacyTransactionRepositoryAdapter({ create } as never);
    await adapter.create({ transaction: { ...DEMO_TRANSACTIONS[0], id: "txn_browser_only", businessId: "eba2eef6-4b30-4e65-85c8-6e3bacc97d02", createdBy: "9c6c7229-7a5c-48d6-99cf-ec1feecd058c" } });
    expect(create).toHaveBeenCalledWith(expect.not.objectContaining({ id: expect.anything() }));
  });

  it("omits server-generated fields instead of serializing them as null", () => {
    const transaction = toDomainTransaction(DEMO_TRANSACTIONS[0]);
    const row = new SupabaseTransactionRepository().mapToDatabase({ ...transaction, id: undefined, version: undefined });
    expect("id" in row).toBe(false);
    expect("version" in row).toBe(false);
  });
});
