import type {
  EInvoiceConnectionRepository,
  MyInvoisEnvironment,
} from "./contracts";
import type { MyInvoisOAuthClient } from "@/integrations/myinvois";

export class EInvoiceConnectionServiceError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "EInvoiceConnectionServiceError";
  }
}

export class EInvoiceConnectionService {
  constructor(
    private readonly repository: EInvoiceConnectionRepository,
    private readonly oauth: MyInvoisOAuthClient,
  ) {}

  async testConnection(businessId: string, environment: MyInvoisEnvironment, actorUserId: string, testedAt: string) {
    const connection = await this.connection(businessId, environment);
    const token = await this.oauth.accessToken(connection);
    await this.repository.markConnectionVerified(connection.id, businessId, actorUserId, testedAt);
    return {
      connected: true as const,
      environment,
      authMode: connection.authMode,
      taxpayerIdentity: connection.onbehalfofValue,
      expiresAt: new Date(token.expiresAt).toISOString(),
    };
  }

  private async connection(businessId: string, environment: MyInvoisEnvironment) {
    const connection = await this.repository.findConnection(businessId, environment);
    if (!connection || !connection.enabled) {
      throw new EInvoiceConnectionServiceError("connection.not_found", `No enabled ${environment} MyInvois connection is configured for this business.`);
    }
    return connection;
  }
}
