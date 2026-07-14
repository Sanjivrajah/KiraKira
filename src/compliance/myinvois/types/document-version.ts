import type { ISODate } from "@/domain";

export interface MyInvoisDocumentVersion {
  version: string;
  active: boolean;
  signatureRequired: boolean;
  effectiveFrom?: ISODate;
  effectiveTo?: ISODate;
  sourceReference: string;
}

export const MYINVOIS_DOCUMENT_VERSIONS: readonly MyInvoisDocumentVersion[] = Object.freeze([
  {
    version: "1.0",
    active: true,
    signatureRequired: false,
    sourceReference: "MyInvois SDK document types v1.0",
  },
  {
    version: "1.1",
    active: true,
    signatureRequired: true,
    sourceReference: "MyInvois SDK document types v1.1",
  },
]);
