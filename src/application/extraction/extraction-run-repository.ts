import type { BusinessId, ExtractionRun, ExtractionRunId, SourceDocumentId } from "@/domain";
import type { BusinessScopedRepository } from "../shared/repository";

export interface ExtractionRunRepository extends BusinessScopedRepository<ExtractionRun, ExtractionRunId> {
  listForSource(businessId: BusinessId, sourceDocumentId: SourceDocumentId): Promise<readonly ExtractionRun[]>;
}
