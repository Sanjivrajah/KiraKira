import type { Business, CommercialDocument, CommercialDocumentType, Party } from "@/domain";
import type { MyInvoisPayloadFormat } from "../types";

export interface MyInvoisMappingContext {
  supplier: Party;
  buyer: Party;
  business: Business;
  shippingRecipient?: Party;
  supplementalFields?: Readonly<Record<string, unknown>>;
}

export interface MyInvoisMappingDiagnostic {
  code: string;
  /** Canonical source path that could not be translated. */
  canonicalPath: string;
  /** Intended UBL destination path. */
  ublPath: string;
  /** @deprecated Use canonicalPath. Kept for callers created before Stage 3. */
  fieldPath: string;
  message: string;
  documentVersion: string;
}

export class MyInvoisMappingError extends Error {
  readonly diagnostics: readonly MyInvoisMappingDiagnostic[];

  constructor(diagnostics: readonly MyInvoisMappingDiagnostic[]) {
    super(diagnostics.map((diagnostic) => `${diagnostic.fieldPath}: ${diagnostic.message}`).join("; "));
    this.name = "MyInvoisMappingError";
    this.diagnostics = Object.freeze([...diagnostics]);
  }
}

export interface MyInvoisDocumentMapper<Payload = unknown> {
  readonly version: string;
  readonly mapperVersion: string;
  readonly payloadFormat: MyInvoisPayloadFormat;
  supports(documentType: CommercialDocumentType): boolean;
  map(document: CommercialDocument, context: MyInvoisMappingContext): Payload;
}
