import { extractionRunSchema, type BusinessId, type ExtractionRun, type ExtractionRunId, type UserId } from "@/domain";
import type { ExtractionRunRepository } from "./extraction-run-repository";
import type { SourceDocumentRepository } from "../source-documents/source-document-repository";
import { ApplicationError } from "../shared/repository";

export interface ApproveExtractionCommand {
  businessId: BusinessId;
  extractionRunId: ExtractionRunId;
  reviewedBy: UserId;
  reviewedAt: string;
  reviewerNotes?: string;
  changedFields?: ExtractionRun["changedFields"];
  idempotencyKey: string;
}

export class ApproveExtractionService {
  constructor(
    private readonly sources: SourceDocumentRepository,
    private readonly extractions: ExtractionRunRepository,
  ) {}

  async execute(command: ApproveExtractionCommand): Promise<ExtractionRun> {
    const existing = await this.extractions.findByIdempotencyKey(command.businessId, command.idempotencyKey);
    if (existing) return existing;
    const run = await this.extractions.getById(command.businessId, command.extractionRunId);
    if (!run) throw new ApplicationError("extraction.not_found", "Extraction run was not found for this business.");
    if (!await this.sources.getById(command.businessId, run.sourceDocumentId)) {
      throw new ApplicationError("extraction.source_not_found", "The extraction source was not found for this business.");
    }
    if (!run.normalizedProposedResult || !["extracted", "needs_review"].includes(run.status)) {
      throw new ApplicationError("extraction.not_reviewable", "Only completed extraction proposals can be approved.");
    }
    const approved = extractionRunSchema.parse({
      ...run,
      status: "approved",
      reviewedBy: command.reviewedBy,
      reviewedAt: command.reviewedAt,
      reviewerNotes: command.reviewerNotes,
      changedFields: command.changedFields ?? run.changedFields,
      updatedAt: command.reviewedAt,
      updatedBy: command.reviewedBy,
      version: (run.version ?? 0) + 1,
    });
    return this.extractions.save(command.businessId, approved, { idempotencyKey: command.idempotencyKey, expectedVersion: run.version });
  }
}

