import { describe, expect, it } from "vitest";
import {
  ApproveExtractionService,
  ConfirmTransactionService,
  CreateInvoiceFromTransactionsService,
  GeneratePayloadSnapshotService,
  AllocatePaymentService,
  ValidateDocumentReadinessService,
} from "@/application";
import {
  InMemoryBusinessRepository,
  InMemoryCommercialDocumentRepository,
  InMemoryExtractionRunRepository,
  InMemoryFinancialTransactionRepository,
  InMemoryMyInvoisReferenceCodeRepository,
  InMemoryMyInvoisSnapshotRepository,
  InMemoryMyInvoisStatusEventRepository,
  InMemoryMyInvoisValidationResultRepository,
  InMemoryPartyRepository,
  InMemoryPaymentAllocationRepository,
  InMemoryPaymentRepository,
  InMemorySourceDocumentRepository,
} from "@/infrastructure";
import {
  businessIdSchema,
  commercialDocumentSchema,
  financialTransactionSchema,
  paymentAllocationSchema,
  paymentSchema,
  userIdSchema,
} from "@/domain";
import { DEMO_FINANCIAL_TRANSACTIONS, DEMO_SOURCE_EXTRACTIONS } from "@/data/demo";
import {
  UBL_FIXTURE_BUSINESS,
  UBL_FIXTURE_BUYER,
  UBL_FIXTURE_SUPPLIER,
  UBL_STANDARD_B2B_INVOICE,
} from "@/compliance/myinvois/fixtures";
import { MYINVOIS_DEVELOPMENT_REFERENCE_CODES } from "@/compliance/myinvois/reference-data";

const fixtureBusinessId = UBL_FIXTURE_BUSINESS.id;

async function seedMappingContext() {
  const businesses = new InMemoryBusinessRepository();
  const parties = new InMemoryPartyRepository();
  const documents = new InMemoryCommercialDocumentRepository();
  await businesses.save(UBL_FIXTURE_BUSINESS);
  await parties.save(fixtureBusinessId, UBL_FIXTURE_SUPPLIER);
  await parties.save(fixtureBusinessId, UBL_FIXTURE_BUYER);
  await documents.save(fixtureBusinessId, UBL_STANDARD_B2B_INVOICE);
  return { businesses, parties, documents };
}

describe("Session 8 backend readiness", () => {
  it("isolates business-owned records across tenant scopes", async () => {
    const parties = new InMemoryPartyRepository();
    const otherBusinessId = businessIdSchema.parse("business_other");
    await parties.save(fixtureBusinessId, UBL_FIXTURE_BUYER);

    expect(await parties.getById(fixtureBusinessId, UBL_FIXTURE_BUYER.id)).not.toBeNull();
    expect(await parties.getById(otherBusinessId, UBL_FIXTURE_BUYER.id)).toBeNull();
    expect(await parties.findByTin(otherBusinessId, "C2584563200")).toEqual([]);
  });

  it("approves an extraction only through its business-scoped source", async () => {
    const sources = new InMemorySourceDocumentRepository();
    const extractions = new InMemoryExtractionRunRepository();
    const fixture = DEMO_SOURCE_EXTRACTIONS[0];
    await sources.save(fixture.sourceDocument.businessId, fixture.sourceDocument);
    await extractions.save(fixture.sourceDocument.businessId, fixture.extractionRun);
    const service = new ApproveExtractionService(sources, extractions);

    const result = await service.execute({
      businessId: fixture.sourceDocument.businessId,
      extractionRunId: fixture.extractionRun.id,
      reviewedBy: userIdSchema.parse("reviewer_1"),
      reviewedAt: "2026-07-15T01:00:00.000Z",
      idempotencyKey: "approve-receipt-1",
    });

    expect(result.status).toBe("approved");
    expect(result.version).toBe(1);
  });

  it("confirms transactions idempotently", async () => {
    const transactions = new InMemoryFinancialTransactionRepository();
    const proposed = financialTransactionSchema.parse({
      ...DEMO_FINANCIAL_TRANSACTIONS[1],
      businessId: fixtureBusinessId,
      lifecycle: "review_required",
      confirmation: undefined,
      version: 0,
    });
    await transactions.save(fixtureBusinessId, proposed);
    const service = new ConfirmTransactionService(transactions);
    const command = {
      businessId: fixtureBusinessId,
      transactionId: proposed.id,
      confirmedBy: userIdSchema.parse("reviewer_1"),
      confirmedAt: "2026-07-15T02:00:00.000Z",
      idempotencyKey: "confirm-transaction-1",
    };

    const first = await service.execute(command);
    const second = await service.execute(command);

    expect(first.lifecycle).toBe("confirmed");
    expect(second).toEqual(first);
    expect((await transactions.list(fixtureBusinessId))).toHaveLength(1);
  });

  it("orchestrates invoice creation from confirmed transactions", async () => {
    const transactions = new InMemoryFinancialTransactionRepository();
    const documents = new InMemoryCommercialDocumentRepository();
    const transaction = financialTransactionSchema.parse({
      ...DEMO_FINANCIAL_TRANSACTIONS[0],
      id: "fixture_source_transaction",
      businessId: fixtureBusinessId,
    });
    await transactions.save(fixtureBusinessId, transaction);
    const document = commercialDocumentSchema.parse({
      ...UBL_STANDARD_B2B_INVOICE,
      id: "fixture_generated_invoice",
      internalDocumentNumber: "INV-FIXTURE-GENERATED",
      sourceTransactionIds: [transaction.id],
    });
    const service = new CreateInvoiceFromTransactionsService(transactions, documents);

    const result = await service.execute({ businessId: fixtureBusinessId, document, idempotencyKey: "invoice-from-transaction-1" });

    expect(result.sourceTransactionIds).toEqual([transaction.id]);
    expect(await documents.findByDocumentNumber(fixtureBusinessId, "INV-FIXTURE-GENERATED")).toEqual(result);
  });

  it("generates immutable, idempotent payload snapshots after readiness validation", async () => {
    const { businesses, parties, documents } = await seedMappingContext();
    const referenceCodes = new InMemoryMyInvoisReferenceCodeRepository(MYINVOIS_DEVELOPMENT_REFERENCE_CODES);
    const validationResults = new InMemoryMyInvoisValidationResultRepository();
    const readiness = new ValidateDocumentReadinessService(businesses, parties, documents, referenceCodes, validationResults);
    const snapshots = new InMemoryMyInvoisSnapshotRepository();
    const events = new InMemoryMyInvoisStatusEventRepository();
    const service = new GeneratePayloadSnapshotService(
      businesses,
      parties,
      documents,
      snapshots,
      readiness,
      events,
      () => "snapshot_fixture_1",
    );
    const command = {
      businessId: fixtureBusinessId,
      documentId: UBL_STANDARD_B2B_INVOICE.id,
      scenario: "b2b_invoice" as const,
      documentVersion: "1.1",
      asOfDate: "2026-07-15",
      generatedAt: "2026-07-15T03:00:00.000Z",
      idempotencyKey: "snapshot-1",
    };

    const first = await service.execute(command);
    const second = await service.execute(command);

    expect(second).toEqual(first);
    expect(first.payloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(Object.isFrozen(first)).toBe(true);
    await expect(snapshots.save(fixtureBusinessId, { ...first, payloadHash: "0".repeat(64) }))
      .rejects.toMatchObject({ code: "repository.immutable" });
    expect(await events.listForDocument(fixtureBusinessId, UBL_STANDARD_B2B_INVOICE.id)).toHaveLength(1);
  });

  it("allocates completed payments without exceeding payment or document totals", async () => {
    const { documents } = await seedMappingContext();
    const payments = new InMemoryPaymentRepository();
    const allocations = new InMemoryPaymentAllocationRepository();
    const payment = paymentSchema.parse({
      id: "payment_fixture_1",
      businessId: fixtureBusinessId,
      paymentDate: "2026-07-15T04:00:00.000Z",
      amount: { amount: "100", currency: "MYR" },
      paymentModeCode: "03",
      status: "completed",
      createdAt: "2026-07-15T04:00:00.000Z",
      updatedAt: "2026-07-15T04:00:00.000Z",
    });
    await payments.save(fixtureBusinessId, payment);
    const allocation = paymentAllocationSchema.parse({
      id: "allocation_fixture_1",
      paymentId: payment.id,
      documentId: UBL_STANDARD_B2B_INVOICE.id,
      allocatedAmount: { amount: "100", currency: "MYR" },
      allocatedAt: "2026-07-15T04:01:00.000Z",
      createdAt: "2026-07-15T04:01:00.000Z",
      updatedAt: "2026-07-15T04:01:00.000Z",
    });
    const service = new AllocatePaymentService(payments, allocations, documents);

    const saved = await service.execute({ businessId: fixtureBusinessId, allocation, idempotencyKey: "allocate-payment-1" });

    expect(saved).toEqual(allocation);
    expect(await allocations.listForDocument(fixtureBusinessId, UBL_STANDARD_B2B_INVOICE.id)).toEqual([allocation]);
  });
});
