import type { Business, CommercialDocument, CommercialDocumentType, Party } from "@/domain";
import type { MyInvoisPayloadFormat } from "../types";

export interface MyInvoisMappingContext {
  supplier: Party;
  buyer: Party;
  business: Business;
}

export interface MyInvoisMappingDiagnostic {
  code: string;
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

