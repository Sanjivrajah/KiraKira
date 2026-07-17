import type {
  EInvoiceSignedSnapshotRecord,
  EInvoiceSigningRepository,
  MyInvoisConnectionRecord,
  MyInvoisEnvironment,
  SigningCertificateMetadata,
} from "./contracts";
import type { MyInvoisIntermediaryOAuthClient, MyInvoisJsonSigningAdapter } from "@/integrations/myinvois";

export class EInvoiceSigningServiceError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "EInvoiceSigningServiceError";
  }
}

export class EInvoiceSigningService {
  constructor(
    private readonly repository: EInvoiceSigningRepository,
    private readonly oauth: MyInvoisIntermediaryOAuthClient,
    private readonly signer: MyInvoisJsonSigningAdapter,
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

  async inspectCertificate(businessId: string, environment: MyInvoisEnvironment): Promise<SigningCertificateMetadata> {
    const connection = await this.connection(businessId, environment);
    this.assertSigningConfigured(connection);
    const metadata = await this.signer.inspectCertificate(connection);
    await this.repository.updateCertificateMetadata(connection.id, businessId, metadata);
    return metadata;
  }

  async signSnapshot(
    businessId: string,
    environment: MyInvoisEnvironment,
    snapshotId: string,
    signingTimestamp: string,
  ): Promise<EInvoiceSignedSnapshotRecord> {
    const [connection, snapshot] = await Promise.all([
      this.connection(businessId, environment),
      this.repository.findUnsignedSnapshot(businessId, snapshotId),
    ]);
    if (!snapshot) throw new EInvoiceSigningServiceError("snapshot.not_found", "The approved unsigned payload snapshot was not found.");
    this.assertSigningConfigured(connection);
    const metadata = await this.signer.inspectCertificate(connection, new Date(signingTimestamp));
    const existing = await this.repository.findSignedSnapshot(snapshot.id, metadata.thumbprintSha256, "myinvois-json-xades-1.0.0");
    if (existing) return existing;
    const result = await this.signer.signPayload(snapshot, connection, signingTimestamp);
    await this.repository.updateCertificateMetadata(connection.id, businessId, result.certificate);
    return this.repository.persistSignedSnapshot({
      businessId,
      unsignedSnapshotId: snapshot.id,
      unsignedPayloadHash: snapshot.unsignedPayloadHash,
      signedPayload: result.signedPayload,
      signedPayloadHash: result.signedPayloadHash,
      certificateThumbprint: result.certificate.thumbprintSha256,
      certificateSubject: result.certificate.subject,
      certificateIssuer: result.certificate.issuer,
      certificateSerialNumber: result.certificate.serialNumber,
      certificateNotAfter: result.certificate.notAfter,
      signingAlgorithm: result.signingAlgorithm,
      implementationVersion: result.implementationVersion,
      environment,
      connectionId: connection.id,
      signingTimestamp: result.signingTimestamp,
    });
  }

  private async connection(businessId: string, environment: MyInvoisEnvironment) {
    const connection = await this.repository.findConnection(businessId, environment);
    if (!connection || !connection.enabled) {
      throw new EInvoiceSigningServiceError("connection.not_found", `No enabled ${environment} MyInvois connection is configured for this business.`);
    }
    return connection;
  }

  private assertSigningConfigured(connection: MyInvoisConnectionRecord): asserts connection is MyInvoisConnectionRecord & {
    signingCertificateSecretRef: string;
    signingPrivateKeySecretRef: string;
  } {
    if (!connection.signingCertificateSecretRef || !connection.signingPrivateKeySecretRef) {
      throw new EInvoiceSigningServiceError("certificate.not_configured", "Digital signing is not configured for this MyInvois connection.");
    }
  }
}
