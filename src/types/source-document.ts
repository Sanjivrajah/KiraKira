import type { AuditableEntity, EntityId } from "./common";
import type { TransactionSourceType } from "./transaction";

export type SourceDocumentStatus = "uploaded" | "processing" | "needs_review" | "completed" | "failed";

export interface SourceDocument extends AuditableEntity {
  businessId: EntityId;
  uploadedBy: EntityId;
  sourceType: Exclude<TransactionSourceType, "manual">;
  fileName?: string | null;
  mimeType?: string | null;
  storagePath?: string | null;
  status: SourceDocumentStatus;
  confidenceScore?: number | null;
  errorMessage?: string | null;
}
