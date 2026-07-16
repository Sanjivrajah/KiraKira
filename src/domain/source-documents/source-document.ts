import type {
  AuditableEntity,
  BusinessId,
  ISODateTime,
  SourceDocumentId,
} from "../common";
import type {
  BankStatementSourceMetadata,
  CsvSourceMetadata,
  DuplicateDetectionFields,
  ExternalSystemSourceMetadata,
  FileHash,
  ManualSourceMetadata,
  ReceiptSourceMetadata,
  VoiceSourceMetadata,
  WhatsAppSourceMetadata,
} from "./source-metadata";

export type SourceDocumentType =
  | "manual"
  | "receipt"
  | "voice"
  | "whatsapp"
  | "csv"
  | "bank_statement"
  | "external_system";

export type SourceDocumentProcessingStatus =
  | "received"
  | "queued"
  | "processing"
  | "needs_review"
  | "processed"
  | "failed";

interface SourceDocumentBase extends Omit<AuditableEntity, "id"> {
  id: SourceDocumentId;
  businessId: BusinessId;
  originalFilename?: string;
  mimeType?: string;
  objectStoragePath?: string;
  fileSizeBytes?: number;
  fileHash?: FileHash;
  rawText?: string;
  sourceMessageReference?: string;
  capturedAt: ISODateTime;
  uploadedAt?: ISODateTime;
  processingStatus: SourceDocumentProcessingStatus;
  failureReason?: string;
  duplicateDetection: DuplicateDetectionFields;
}

export type SourceDocument = SourceDocumentBase &
  (
    | { sourceType: "manual"; sourceMetadata: ManualSourceMetadata }
    | { sourceType: "receipt"; sourceMetadata: ReceiptSourceMetadata }
    | { sourceType: "voice"; sourceMetadata: VoiceSourceMetadata }
    | { sourceType: "whatsapp"; sourceMetadata: WhatsAppSourceMetadata }
    | { sourceType: "csv"; sourceMetadata: CsvSourceMetadata }
    | { sourceType: "bank_statement"; sourceMetadata: BankStatementSourceMetadata }
    | { sourceType: "external_system"; sourceMetadata: ExternalSystemSourceMetadata }
  );
