import type {
  BusinessRepository,
  CommercialDocumentRepository,
  ExtractionRunRepository,
  FinancialTransactionRepository,
  MyInvoisReferenceCodeRepository,
  MyInvoisSnapshotRepository,
  MyInvoisStatusEventRepository,
  MyInvoisSubmissionRepository,
  MyInvoisValidationResultRepository,
  PartyRepository,
  PaymentAllocationRepository,
  PaymentRepository,
  RepositoryWriteOptions,
  SourceDocumentRepository,
} from "@/application";
import { ApplicationError } from "@/application";
import type {
  Business,
  BusinessId,
  CommercialDocument,
  DocumentId,
  ExtractionRun,
  ExtractionRunId,
  FinancialTransaction,
  Party,
  PartyId,
  Payment,
  PaymentAllocation,
  PaymentAllocationId,
  PaymentId,
  SourceDocument,
  SourceDocumentId,
  TransactionId,
} from "@/domain";
import type {
  MyInvoisDocumentSnapshot,
  MyInvoisStatusEvent,
  MyInvoisSubmission,
  MyInvoisValidationResult,
} from "@/compliance/myinvois/types";
import type { MyInvoisCodeSetName, MyInvoisReferenceCode } from "@/compliance/myinvois/reference-data";

type Identified<Identifier extends string> = { id: Identifier; version?: number; businessId?: BusinessId };
const copy = <Value>(value: Value): Value => structuredClone(value);

function deepFreeze<Value>(value: Value): Value {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export class InMemoryScopedRepository<Entity extends Identified<Identifier>, Identifier extends string> {
  protected readonly records = new Map<string, Map<Identifier, Entity>>();
  protected readonly idempotency = new Map<string, Identifier>();

  constructor(private readonly immutable = false) {}

  async getById(businessId: BusinessId, id: Identifier): Promise<Entity | null> {
    const value = this.records.get(businessId)?.get(id);
    return value ? copy(value) : null;
  }

  async list(businessId: BusinessId): Promise<readonly Entity[]> {
    return [...(this.records.get(businessId)?.values() ?? [])].map(copy);
  }

  async findByIdempotencyKey(businessId: BusinessId, idempotencyKey: string): Promise<Entity | null> {
    const id = this.idempotency.get(`${businessId}:${idempotencyKey}`);
    return id ? this.getById(businessId, id) : null;
  }

  async save(businessId: BusinessId, entity: Entity, options: RepositoryWriteOptions = {}): Promise<Entity> {
    if (entity.businessId && entity.businessId !== businessId) {
      throw new ApplicationError("tenancy.mismatch", "Entity belongs to another business.");
    }
    const scope = this.records.get(businessId) ?? new Map<Identifier, Entity>();
    const current = scope.get(entity.id);
    if (this.immutable && current && JSON.stringify(current) !== JSON.stringify(entity)) {
      throw new ApplicationError("repository.immutable", "Immutable records cannot be changed.");
    }
    if (options.expectedVersion !== undefined && (current?.version ?? 0) !== (options.expectedVersion ?? 0)) {
      throw new ApplicationError("repository.version_conflict", "The record was changed by another operation.");
    }
    if (options.idempotencyKey) {
      const key = `${businessId}:${options.idempotencyKey}`;
      const existingId = this.idempotency.get(key);
      if (existingId) return this.getById(businessId, existingId) as Promise<Entity>;
      this.idempotency.set(key, entity.id);
    }
    scope.set(entity.id, copy(entity));
    this.records.set(businessId, scope);
    return copy(entity);
  }
}

export class InMemoryBusinessRepository implements BusinessRepository {
  private readonly records = new Map<BusinessId, Business>();
  private readonly idempotency = new Map<string, BusinessId>();

  async getById(id: BusinessId) { return this.records.has(id) ? copy(this.records.get(id)!) : null; }

  async save(business: Business, options: RepositoryWriteOptions = {}) {
    if (options.idempotencyKey) {
      const id = this.idempotency.get(options.idempotencyKey);
      if (id) return copy(this.records.get(id)!);
      this.idempotency.set(options.idempotencyKey, business.id);
    }
    const current = this.records.get(business.id);
    if (options.expectedVersion !== undefined && (current?.version ?? 0) !== options.expectedVersion) {
      throw new ApplicationError("repository.version_conflict", "The business was changed by another operation.");
    }
    this.records.set(business.id, copy(business));
    return copy(business);
  }
}

export class InMemoryPartyRepository extends InMemoryScopedRepository<Party, PartyId> implements PartyRepository {
  async findByTin(businessId: BusinessId, tin: string) {
    return (await this.list(businessId)).filter((party) => party.taxIdentifiers.some((identifier) => identifier.scheme === "tin" && identifier.value === tin));
  }
  async findByRegistration(businessId: BusinessId, value: string) {
    return (await this.list(businessId)).filter((party) => party.registrationIdentifiers.some((identifier) => identifier.value === value));
  }
}

export class InMemorySourceDocumentRepository extends InMemoryScopedRepository<SourceDocument, SourceDocumentId> implements SourceDocumentRepository {
  async findByFileHash(businessId: BusinessId, sha256: string) {
    return (await this.list(businessId)).find((source) => source.fileHash?.value === sha256) ?? null;
  }
}

export class InMemoryExtractionRunRepository extends InMemoryScopedRepository<ExtractionRun & Identified<ExtractionRunId>, ExtractionRunId> implements ExtractionRunRepository {
  async listForSource(businessId: BusinessId, sourceDocumentId: SourceDocumentId) {
    return (await this.list(businessId)).filter((run) => run.sourceDocumentId === sourceDocumentId);
  }
}

export class InMemoryFinancialTransactionRepository extends InMemoryScopedRepository<FinancialTransaction, TransactionId> implements FinancialTransactionRepository {
  async listByDateRange(businessId: BusinessId, from: Parameters<FinancialTransactionRepository["listByDateRange"]>[1], to: Parameters<FinancialTransactionRepository["listByDateRange"]>[2]) {
    return (await this.list(businessId)).filter((transaction) => transaction.transactionDate >= from && transaction.transactionDate <= to);
  }
}

export class InMemoryCommercialDocumentRepository extends InMemoryScopedRepository<CommercialDocument, DocumentId> implements CommercialDocumentRepository {
  async findByDocumentNumber(businessId: BusinessId, documentNumber: string) {
    return (await this.list(businessId)).find((document) => document.internalDocumentNumber === documentNumber) ?? null;
  }
}

export class InMemoryPaymentRepository extends InMemoryScopedRepository<Payment, PaymentId> implements PaymentRepository {
  async findByExternalReference(businessId: BusinessId, externalReference: string) {
    return (await this.list(businessId)).find((payment) => payment.externalReference === externalReference) ?? null;
  }
}

export class InMemoryPaymentAllocationRepository extends InMemoryScopedRepository<PaymentAllocation & Identified<PaymentAllocationId>, PaymentAllocationId> implements PaymentAllocationRepository {
  async listForPayment(businessId: BusinessId, paymentId: PaymentId) {
    return (await this.list(businessId)).filter((allocation) => allocation.paymentId === paymentId);
  }
  async listForDocument(businessId: BusinessId, documentId: DocumentId) {
    return (await this.list(businessId)).filter((allocation) => allocation.documentId === documentId);
  }
}

export class InMemoryMyInvoisSnapshotRepository extends InMemoryScopedRepository<MyInvoisDocumentSnapshot & Identified<string>, string> implements MyInvoisSnapshotRepository {
  constructor() { super(true); }
  override async getById(businessId: BusinessId, id: string) {
    const value = await super.getById(businessId, id);
    return value ? deepFreeze(value) : null;
  }
  override async save(businessId: BusinessId, entity: MyInvoisDocumentSnapshot & Identified<string>, options?: RepositoryWriteOptions) {
    return deepFreeze(await super.save(businessId, entity, options));
  }
  override async list(businessId: BusinessId) {
    return (await super.list(businessId)).map(deepFreeze);
  }
  async listForDocument(businessId: BusinessId, documentId: DocumentId) {
    return (await this.list(businessId)).filter((snapshot) => snapshot.commercialDocumentId === documentId).map(deepFreeze);
  }
}

export class InMemoryMyInvoisSubmissionRepository extends InMemoryScopedRepository<MyInvoisSubmission & Identified<string>, string> implements MyInvoisSubmissionRepository {
  async findBySubmissionUid(businessId: BusinessId, submissionUid: string) {
    return (await this.list(businessId)).find((submission) => submission.submissionUid === submissionUid) ?? null;
  }
}

export class InMemoryMyInvoisStatusEventRepository implements MyInvoisStatusEventRepository {
  private readonly events = new Map<BusinessId, MyInvoisStatusEvent[]>();
  private readonly idempotency = new Set<string>();
  async append(businessId: BusinessId, event: MyInvoisStatusEvent, options: RepositoryWriteOptions = {}) {
    const key = options.idempotencyKey ? `${businessId}:${options.idempotencyKey}` : "";
    if (key && this.idempotency.has(key)) {
      return copy(this.events.get(businessId)?.find((candidate) => candidate.id === event.id) ?? event);
    }
    if (this.events.get(businessId)?.some((candidate) => candidate.id === event.id)) {
      throw new ApplicationError("repository.append_only", "Status event IDs cannot be overwritten.");
    }
    this.events.set(businessId, [...(this.events.get(businessId) ?? []), copy(event)]);
    if (key) this.idempotency.add(key);
    return deepFreeze(copy(event));
  }
  async listForDocument(businessId: BusinessId, documentId: DocumentId) {
    return (this.events.get(businessId) ?? []).filter((event) => event.commercialDocumentId === documentId).map((event) => deepFreeze(copy(event)));
  }
}

export class InMemoryMyInvoisValidationResultRepository implements MyInvoisValidationResultRepository {
  private readonly results = new Map<string, MyInvoisValidationResult[]>();
  async append(businessId: BusinessId, documentId: DocumentId, results: readonly MyInvoisValidationResult[]) {
    const key = `${businessId}:${documentId}`;
    const next = [...(this.results.get(key) ?? []), ...results.map(copy)];
    this.results.set(key, next);
    return next.map((result) => deepFreeze(copy(result)));
  }
  async listForDocument(businessId: BusinessId, documentId: DocumentId) {
    return (this.results.get(`${businessId}:${documentId}`) ?? []).map((result) => deepFreeze(copy(result)));
  }
}

export class InMemoryMyInvoisReferenceCodeRepository implements MyInvoisReferenceCodeRepository {
  private codes: MyInvoisReferenceCode[];
  constructor(initialCodes: readonly MyInvoisReferenceCode[] = []) { this.codes = initialCodes.map(copy); }
  async list(codeSet?: MyInvoisCodeSetName) { return this.codes.filter((code) => !codeSet || code.codeSet === codeSet).map(copy); }
  async replaceVersion(sourceVersion: string, codes: readonly MyInvoisReferenceCode[]) {
    this.codes = [...this.codes.filter((code) => code.sourceVersion !== sourceVersion), ...codes.map(copy)];
  }
}
