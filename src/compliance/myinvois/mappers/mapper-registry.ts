import type { CommercialDocumentType } from "@/domain";
import type { MyInvoisPayloadFormat } from "../types";
import { MyInvoisMappingError, type MyInvoisDocumentMapper } from "./mapper";

export class MyInvoisMapperRegistry {
  readonly #mappers: readonly MyInvoisDocumentMapper[];

  constructor(mappers: readonly MyInvoisDocumentMapper[]) {
    this.#mappers = Object.freeze([...mappers]);
  }

  resolve(input: {
    version: string;
    documentType: CommercialDocumentType;
    payloadFormat: MyInvoisPayloadFormat;
  }): MyInvoisDocumentMapper {
    const mapper = this.#mappers.find((candidate) =>
      candidate.version === input.version
      && candidate.payloadFormat === input.payloadFormat
      && candidate.supports(input.documentType),
    );
    if (!mapper) {
      throw new MyInvoisMappingError([{
        code: "mapper.unsupported",
        canonicalPath: "document.documentType",
        ublPath: "/Invoice/InvoiceTypeCode",
        fieldPath: "mapper",
        message: `No ${input.payloadFormat} mapper supports ${input.documentType} for version ${input.version}.`,
        documentVersion: input.version,
      }]);
    }
    return mapper;
  }
}
