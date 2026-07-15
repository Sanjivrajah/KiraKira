import { createMyInvoisReferenceCatalog } from "@/compliance/myinvois/reference-data";
import {
  validateMyInvoisReadiness,
  type MyInvoisReadinessResult,
  type MyInvoisValidationScenario,
} from "@/compliance/myinvois/validation";
import type { BusinessId, DocumentId } from "@/domain";
import type { BusinessRepository } from "../businesses/business-repository";
import type { CommercialDocumentRepository } from "../documents/commercial-document-repository";
import type { PartyRepository } from "../parties/party-repository";
import { ApplicationError } from "../shared/repository";
import type { MyInvoisReferenceCodeRepository, MyInvoisValidationResultRepository } from "./myinvois-repositories";

export interface ValidateDocumentReadinessCommand {
  businessId: BusinessId;
  documentId: DocumentId;
  scenario: MyInvoisValidationScenario;
  documentVersion: string;
  asOfDate: string;
  validatedAt: string;
}

export class ValidateDocumentReadinessService {
  constructor(
    private readonly businesses: BusinessRepository,
    private readonly parties: PartyRepository,
    private readonly documents: CommercialDocumentRepository,
    private readonly referenceCodes: MyInvoisReferenceCodeRepository,
    private readonly validationResults?: MyInvoisValidationResultRepository,
  ) {}

  async execute(command: ValidateDocumentReadinessCommand): Promise<MyInvoisReadinessResult> {
    const document = await this.documents.getById(command.businessId, command.documentId);
    if (!document) throw new ApplicationError("document.not_found", "Document was not found for this business.");
    const [business, supplier, buyer, codes] = await Promise.all([
      this.businesses.getById(command.businessId),
      this.parties.getById(command.businessId, document.supplierPartyId),
      this.parties.getById(command.businessId, document.buyerPartyId),
      this.referenceCodes.list(),
    ]);
    if (!business || !supplier || !buyer) {
      throw new ApplicationError("document.context_incomplete", "Business, supplier, and buyer records are required.");
    }
    const result = validateMyInvoisReadiness({
      document,
      business,
      supplier,
      buyer,
      scenario: command.scenario,
      referenceData: createMyInvoisReferenceCatalog(codes),
      asOfDate: command.asOfDate as never,
      validatedAt: command.validatedAt as never,
      documentVersion: command.documentVersion,
    });
    if (this.validationResults) {
      await this.validationResults.append(command.businessId, document.id, result.allIssues.map((issue) => ({
        code: issue.ruleId,
        severity: issue.severity,
        fieldPath: issue.fieldPath,
        message: issue.message,
        source: "local" as const,
        validatedAt: command.validatedAt as never,
      })));
    }
    return result;
  }
}

