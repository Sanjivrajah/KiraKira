import {
  commercialDocumentSchema,
  type BusinessId,
  type CommercialDocument,
  type DocumentId,
} from "@/domain";
import { ApplicationError } from "../shared/repository";
import type { FinancialTransactionRepository } from "../transactions/transaction-repository";
import type { CommercialDocumentRepository } from "./commercial-document-repository";

export interface CreateInvoiceFromTransactionsCommand {
  businessId: BusinessId;
  document: CommercialDocument;
  idempotencyKey: string;
}

export class CreateInvoiceFromTransactionsService {
  constructor(
    private readonly transactions: FinancialTransactionRepository,
    private readonly documents: CommercialDocumentRepository,
  ) {}

  async execute(command: CreateInvoiceFromTransactionsCommand): Promise<CommercialDocument> {
    const existing = await this.documents.findByIdempotencyKey(command.businessId, command.idempotencyKey);
    if (existing) return existing;
    const document = commercialDocumentSchema.parse(command.document);
    if (document.businessId !== command.businessId) throw new ApplicationError("tenancy.mismatch", "Document belongs to another business.");
    if (!document.documentType.endsWith("invoice")) {
      throw new ApplicationError("document.type_invalid", "Invoice generation requires an invoice document type.");
    }
    if (!document.sourceTransactionIds.length) {
      throw new ApplicationError("document.transactions_required", "At least one source transaction is required.");
    }
    for (const transactionId of document.sourceTransactionIds) {
      const transaction = await this.transactions.getById(command.businessId, transactionId);
      if (!transaction) throw new ApplicationError("transaction.not_found", `Source transaction ${transactionId} was not found.`);
      if (transaction.lifecycle !== "confirmed") throw new ApplicationError("transaction.not_confirmed", "All source transactions must be confirmed.");
      if (transaction.currency !== document.currency) throw new ApplicationError("document.currency_mismatch", "Source transactions and document must use one currency.");
    }
    if (await this.documents.findByDocumentNumber(command.businessId, document.internalDocumentNumber)) {
      throw new ApplicationError("document.number_conflict", "Document number already exists for this business.");
    }
    return this.documents.save(command.businessId, document, { idempotencyKey: command.idempotencyKey });
  }
}

export interface CreateAdjustmentDocumentCommand {
  businessId: BusinessId;
  originalDocumentId: DocumentId;
  adjustment: CommercialDocument;
  idempotencyKey: string;
}

export class CreateAdjustmentDocumentService {
  constructor(private readonly documents: CommercialDocumentRepository) {}

  async execute(command: CreateAdjustmentDocumentCommand): Promise<CommercialDocument> {
    const existing = await this.documents.findByIdempotencyKey(command.businessId, command.idempotencyKey);
    if (existing) return existing;
    const original = await this.documents.getById(command.businessId, command.originalDocumentId);
    if (!original) throw new ApplicationError("document.original_not_found", "Original document was not found for this business.");
    const adjustment = commercialDocumentSchema.parse(command.adjustment);
    if (adjustment.businessId !== command.businessId) throw new ApplicationError("tenancy.mismatch", "Adjustment belongs to another business.");
    if (!adjustment.documentType.includes("credit_note") && !adjustment.documentType.includes("debit_note") && !adjustment.documentType.includes("refund_note")) {
      throw new ApplicationError("document.adjustment_type_invalid", "Adjustment must be a credit, debit, or refund note.");
    }
    const linked = adjustment.references.some((reference) =>
      reference.type === "original_invoice" && reference.internalDocumentId === original.id,
    );
    if (!linked) throw new ApplicationError("document.original_reference_missing", "Adjustment must reference the original document.");
    return this.documents.save(command.businessId, adjustment, { idempotencyKey: command.idempotencyKey });
  }
}

