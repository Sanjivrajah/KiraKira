import type { DocumentId, ISODateTime } from "@/domain";

export type MyInvoisEnvironment = "sandbox" | "production";
export type MyInvoisSubmissionStatus = "pending" | "submitted" | "processing" | "completed" | "failed";

export interface MyInvoisSubmission {
  id: string;
  environment: MyInvoisEnvironment;
  submissionUid?: string;
  status: MyInvoisSubmissionStatus;
  requestedAt: ISODateTime;
  completedAt?: ISODateTime;
  submittedDocumentIds: DocumentId[];
  httpStatus?: number;
  retryCount: number;
  idempotencyKey: string;
  errorCode?: string;
  errorMessage?: string;
}
