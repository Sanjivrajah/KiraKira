import type { ExtractionRunId, SourceDocumentId } from "../common";

export type TransactionSourceRelationship = "primary" | "supporting" | "derived";

export interface TransactionSourceLink {
  sourceDocumentId: SourceDocumentId;
  extractionRunId?: ExtractionRunId;
  relationship: TransactionSourceRelationship;
  evidenceNotes?: string;
}
