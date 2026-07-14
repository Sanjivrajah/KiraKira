import type { DocumentId, ISODateTime } from "@/domain";
import type { JsonValue } from "@/domain";
import type { MyInvoisValidationResult } from "./validation-result";

export type MyInvoisPayloadFormat = "json" | "xml";
export type MyInvoisDocumentStatus =
  | "generated"
  | "submitted"
  | "processing"
  | "valid"
  | "invalid"
  | "cancelled"
  | "rejected"
  | "submission_failed";

export interface MyInvoisDocumentSnapshot {
  readonly id: string;
  readonly commercialDocumentId: DocumentId;
  readonly documentTypeCode: string;
  readonly documentVersion: string;
  readonly format: MyInvoisPayloadFormat;
  readonly unsignedPayload: JsonValue | string;
  readonly signedPayload?: JsonValue | string;
  readonly payloadHash: string;
  readonly generatedAt: ISODateTime;
  readonly mapperVersion: string;
}

export interface MyInvoisDocumentState {
  commercialDocumentId: DocumentId;
  myInvoisUuid?: string;
  longId?: string;
  status: MyInvoisDocumentStatus;
  validationResults: MyInvoisValidationResult[];
  submittedAt?: ISODateTime;
  validatedAt?: ISODateTime;
  cancellationDeadline?: ISODateTime;
  qrCodeUrl?: string;
  shareUrl?: string;
}

export interface MyInvoisStatusEvent {
  readonly id: string;
  readonly commercialDocumentId: DocumentId;
  readonly status: MyInvoisDocumentStatus;
  readonly occurredAt: ISODateTime;
  readonly source: "niagaai" | "myinvois";
  readonly details?: string;
}
