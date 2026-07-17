import type { CommercialDocument } from "@/domain";
import { InvoiceV11Mapper } from "./invoice-v1_1.mapper";
import {
  MyInvoisMappingError,
  type MyInvoisDocumentMapper,
  type MyInvoisMappingContext,
} from "./mapper";

/**
 * MyInvois v1.0 uses the same unsigned UBL JSON shape used by the v1.1 mapper
 * in this project; the submission version is selected by listVersionID. v1.1
 * remains available solely for the optional digital-signature workflow.
 */
export class InvoiceV10Mapper implements MyInvoisDocumentMapper {
  readonly version = "1.0";
  readonly mapperVersion = "invoice-v1.0.1";
  readonly payloadFormat = "json" as const;

  private readonly base = new InvoiceV11Mapper();

  supports(documentType: CommercialDocument["documentType"]): boolean {
    return this.base.supports(documentType);
  }

  map(document: CommercialDocument, context: MyInvoisMappingContext): unknown {
    try {
      const payload = this.base.map(document, context);
      const invoice = payload.Invoice[0];
      return {
        ...payload,
        Invoice: [{
          ...invoice,
          InvoiceTypeCode: invoice.InvoiceTypeCode.map((code) => ({ ...code, listVersionID: "1.0" })),
        }],
      };
    } catch (error) {
      if (!(error instanceof MyInvoisMappingError)) throw error;
      throw new MyInvoisMappingError(error.diagnostics.map((diagnostic) => ({
        ...diagnostic,
        documentVersion: this.version,
      })));
    }
  }
}

export const invoiceV10Mapper = new InvoiceV10Mapper();
