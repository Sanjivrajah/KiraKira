import type { BusinessId, CommercialDocument, DocumentId } from "@/domain";
import type { BusinessScopedRepository } from "../shared/repository";

export interface CommercialDocumentRepository extends BusinessScopedRepository<CommercialDocument, DocumentId> {
  findByDocumentNumber(businessId: BusinessId, documentNumber: string): Promise<CommercialDocument | null>;
}
