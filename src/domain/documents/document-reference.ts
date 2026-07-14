import type { DocumentId, ISODate } from "../common";

export type DocumentReferenceType =
  | "original_invoice"
  | "purchase_order"
  | "sales_order"
  | "customs_form"
  | "contract"
  | "other";

export interface DocumentReference {
  type: DocumentReferenceType;
  internalDocumentId?: DocumentId;
  myInvoisUuid?: string;
  externalReference?: string;
  issueDate?: ISODate;
  description?: string;
}
