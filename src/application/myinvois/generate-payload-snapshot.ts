import { MYINVOIS_MAPPER_REGISTRY, hashMyInvoisPayload } from "@/compliance/myinvois/mappers";
import { createImmutableMyInvoisSnapshot, type MyInvoisDocumentSnapshot } from "@/compliance/myinvois/types";
import type { BusinessRepository } from "../businesses/business-repository";
import type { CommercialDocumentRepository } from "../documents/commercial-document-repository";
import type { PartyRepository } from "../parties/party-repository";
import { ApplicationError } from "../shared/repository";
import type { MyInvoisSnapshotRepository, MyInvoisStatusEventRepository } from "./myinvois-repositories";
import type { ValidateDocumentReadinessCommand } from "./validate-document-readiness";
import { ValidateDocumentReadinessService } from "./validate-document-readiness";

export interface GeneratePayloadSnapshotCommand extends Omit<ValidateDocumentReadinessCommand, "validatedAt"> {
  generatedAt: string;
  idempotencyKey: string;
}

export class GeneratePayloadSnapshotService {
  constructor(
    private readonly businesses: BusinessRepository,
    private readonly parties: PartyRepository,
    private readonly documents: CommercialDocumentRepository,
    private readonly snapshots: MyInvoisSnapshotRepository,
    private readonly readiness: ValidateDocumentReadinessService,
    private readonly statusEvents?: MyInvoisStatusEventRepository,
    private readonly makeId: () => string = () => crypto.randomUUID(),
  ) {}

  async execute(command: GeneratePayloadSnapshotCommand): Promise<MyInvoisDocumentSnapshot> {
    const existing = await this.snapshots.findByIdempotencyKey(command.businessId, command.idempotencyKey);
    if (existing) return existing;
    const readiness = await this.readiness.execute({ ...command, validatedAt: command.generatedAt });
    if (!readiness.myInvoisSubmission.ready) {
      throw new ApplicationError("myinvois.not_ready", "Document must pass local MyInvois readiness before payload generation.");
    }
    const document = await this.documents.getById(command.businessId, command.documentId);
    if (!document) throw new ApplicationError("document.not_found", "Document was not found for this business.");
    const [business, supplier, buyer] = await Promise.all([
      this.businesses.getById(command.businessId),
      this.parties.getById(command.businessId, document.supplierPartyId),
      this.parties.getById(command.businessId, document.buyerPartyId),
    ]);
    if (!business || !supplier || !buyer) throw new ApplicationError("document.context_incomplete", "Mapping context is incomplete.");
    const mapper = MYINVOIS_MAPPER_REGISTRY.resolve({
      version: command.documentVersion,
      documentType: document.documentType,
      payloadFormat: "json",
    });
    const payload = mapper.map(document, { business, supplier, buyer });
    const typeCode = document.documentType === "invoice" ? "01" : "00";
    const snapshot = createImmutableMyInvoisSnapshot({
      id: this.makeId(),
      commercialDocumentId: document.id,
      documentTypeCode: typeCode,
      documentVersion: command.documentVersion,
      format: "json",
      unsignedPayload: payload,
      payloadHash: hashMyInvoisPayload(payload),
      generatedAt: command.generatedAt,
      mapperVersion: mapper.mapperVersion,
    });
    const saved = await this.snapshots.save(command.businessId, snapshot, { idempotencyKey: command.idempotencyKey });
    if (this.statusEvents) {
      await this.statusEvents.append(command.businessId, {
        id: `${saved.id}:generated`,
        commercialDocumentId: document.id,
        status: "generated",
        occurredAt: command.generatedAt as never,
        source: "niagaai",
      }, { idempotencyKey: `${command.idempotencyKey}:event` });
    }
    return saved;
  }
}
