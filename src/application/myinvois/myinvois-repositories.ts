import type { BusinessId, DocumentId } from "@/domain";
import type {
  MyInvoisDocumentSnapshot,
  MyInvoisStatusEvent,
  MyInvoisSubmission,
  MyInvoisValidationResult,
} from "@/compliance/myinvois/types";
import type { MyInvoisCodeSetName, MyInvoisReferenceCode } from "@/compliance/myinvois/reference-data";
import type { BusinessScopedRepository, RepositoryWriteOptions } from "../shared/repository";

export interface MyInvoisSnapshotRepository extends BusinessScopedRepository<MyInvoisDocumentSnapshot, string> {
  listForDocument(businessId: BusinessId, documentId: DocumentId): Promise<readonly MyInvoisDocumentSnapshot[]>;
}

export interface MyInvoisSubmissionRepository extends BusinessScopedRepository<MyInvoisSubmission, string> {
  findBySubmissionUid(businessId: BusinessId, submissionUid: string): Promise<MyInvoisSubmission | null>;
}

export interface MyInvoisStatusEventRepository {
  append(businessId: BusinessId, event: MyInvoisStatusEvent, options?: RepositoryWriteOptions): Promise<MyInvoisStatusEvent>;
  listForDocument(businessId: BusinessId, documentId: DocumentId): Promise<readonly MyInvoisStatusEvent[]>;
}

export interface MyInvoisValidationResultRepository {
  append(businessId: BusinessId, documentId: DocumentId, results: readonly MyInvoisValidationResult[]): Promise<readonly MyInvoisValidationResult[]>;
  listForDocument(businessId: BusinessId, documentId: DocumentId): Promise<readonly MyInvoisValidationResult[]>;
}

export interface MyInvoisReferenceCodeRepository {
  list(codeSet?: MyInvoisCodeSetName): Promise<readonly MyInvoisReferenceCode[]>;
  replaceVersion(sourceVersion: string, codes: readonly MyInvoisReferenceCode[]): Promise<void>;
}

