import type { BusinessId, SourceDocument, SourceDocumentId } from "@/domain";
import type { BusinessScopedRepository } from "../shared/repository";

export interface SourceDocumentRepository extends BusinessScopedRepository<SourceDocument, SourceDocumentId> {
  findByFileHash(businessId: BusinessId, sha256: string): Promise<SourceDocument | null>;
}
