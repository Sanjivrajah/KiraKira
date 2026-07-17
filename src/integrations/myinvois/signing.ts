import "server-only";
import {
  X509Certificate,
  createHash,
  createPrivateKey,
  sign,
  verify,
} from "node:crypto";
import type {
  EInvoicePayloadSnapshotRecord,
  MyInvoisConnectionRecord,
  SigningCertificateMetadata,
} from "@/application/e-invoices";
import type { SecretProvider } from "./secrets";

const DIGEST_ALGORITHM = "http://www.w3.org/2001/04/xmlenc#sha256";
const SIGNATURE_ALGORITHM = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
const SIGNED_PROPERTIES_TYPE = "http://uri.etsi.org/01903/v1.3.2#SignedProperties";
const SIGNATURE_URN = "urn:oasis:names:specification:ubl:signature:Invoice";
const EXTENSION_URN = "urn:oasis:names:specification:ubl:dsig:enveloped:xades";

export const MYINVOIS_JSON_SIGNER_VERSION = "myinvois-json-xades-1.0.0";

type JsonObject = Record<string, unknown>;

export interface MyInvoisSigningResult {
  signedPayload: string;
  signedPayloadHash: string;
  signingTimestamp: string;
  signingAlgorithm: "RSA-SHA256";
  implementationVersion: string;
  certificate: SigningCertificateMetadata;
}

export class MyInvoisSigningError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "MyInvoisSigningError";
  }
}

function sha256(value: string | Buffer): Buffer {
  return createHash("sha256").update(value).digest();
}

function certificateBody(certificate: X509Certificate): string {
  return certificate.raw.toString("base64");
}

function serialAsDecimal(serial: string): string {
  try { return BigInt(`0x${serial.replaceAll(":", "")}`).toString(10); }
  catch { throw new MyInvoisSigningError("certificate.serial_invalid", "The signing certificate has an invalid serial number."); }
}

function metadata(certificate: X509Certificate, now: Date): SigningCertificateMetadata {
  const notBefore = new Date(certificate.validFrom);
  const notAfter = new Date(certificate.validTo);
  if (!Number.isFinite(notBefore.valueOf()) || !Number.isFinite(notAfter.valueOf())) {
    throw new MyInvoisSigningError("certificate.validity_invalid", "The signing certificate validity period is invalid.");
  }
  if (now < notBefore) throw new MyInvoisSigningError("certificate.not_yet_valid", `The signing certificate is not valid until ${notBefore.toISOString()}.`);
  if (now >= notAfter) throw new MyInvoisSigningError("certificate.expired", `The signing certificate expired at ${notAfter.toISOString()}.`);
  return {
    thumbprintSha256: createHash("sha256").update(certificate.raw).digest("hex"),
    subject: certificate.subject,
    issuer: certificate.issuer,
    serialNumber: serialAsDecimal(certificate.serialNumber),
    notBefore: notBefore.toISOString(),
    notAfter: notAfter.toISOString(),
    expiresWithinDays: Math.max(0, Math.ceil((notAfter.valueOf() - now.valueOf()) / 86_400_000)),
  };
}

function assertChain(leaf: X509Certificate, chainPem?: string): void {
  if (!chainPem?.trim()) return;
  const blocks = chainPem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? [];
  if (!blocks.length) throw new MyInvoisSigningError("certificate.chain_invalid", "The configured certificate chain is invalid.");
  let child = leaf;
  for (const block of blocks) {
    const issuer = new X509Certificate(block);
    if (!child.verify(issuer.publicKey)) {
      throw new MyInvoisSigningError("certificate.chain_invalid", "The signing certificate chain could not be verified.");
    }
    child = issuer;
  }
  if (child.subject === child.issuer && !child.verify(child.publicKey)) {
    throw new MyInvoisSigningError("certificate.chain_invalid", "The signing certificate root could not be verified.");
  }
}

function unsignedInvoice(payload: string): { root: JsonObject; invoice: JsonObject } {
  let root: JsonObject;
  try { root = JSON.parse(payload) as JsonObject; }
  catch { throw new MyInvoisSigningError("payload.invalid_json", "The unsigned snapshot is not valid JSON."); }
  const invoices = root.Invoice;
  if (!Array.isArray(invoices) || invoices.length !== 1 || !invoices[0] || typeof invoices[0] !== "object") {
    throw new MyInvoisSigningError("payload.invalid_invoice", "The unsigned snapshot must contain exactly one UBL Invoice.");
  }
  const invoice = invoices[0] as JsonObject;
  if ("UBLExtensions" in invoice || "Signature" in invoice) {
    throw new MyInvoisSigningError("payload.already_signed", "The source snapshot already contains signature elements.");
  }
  return { root, invoice };
}

function signingElements(input: {
  signingTimestamp: string;
  certDigest: string;
  certificate: X509Certificate;
  certificateMetadata: SigningCertificateMetadata;
  docDigest: string;
  signatureValue: string;
}) {
  const signedProperties = {
    Id: "id-xades-signed-props",
    SignedSignatureProperties: [{
      SigningTime: [{ _: input.signingTimestamp }],
      SigningCertificate: [{ Cert: [{
        CertDigest: [{ DigestMethod: [{ _: "", Algorithm: DIGEST_ALGORITHM }], DigestValue: [{ _: input.certDigest }] }],
        IssuerSerial: [{
          X509IssuerName: [{ _: input.certificateMetadata.issuer }],
          X509SerialNumber: [{ _: input.certificateMetadata.serialNumber }],
        }],
      }] }],
    }],
  };
  const qualifyingProperties = { Target: "signature", SignedProperties: [signedProperties] };
  const propsDigest = sha256(JSON.stringify(qualifyingProperties)).toString("base64");
  return {
    propsDigest,
    qualifyingProperties,
    extension: [{ UBLExtension: [{
      ExtensionURI: [{ _: EXTENSION_URN }],
      ExtensionContent: [{ UBLDocumentSignatures: [{ SignatureInformation: [{
        ID: [{ _: "urn:oasis:names:specification:ubl:signature:1" }],
        ReferencedSignatureID: [{ _: SIGNATURE_URN }],
        Signature: [{
          Id: "signature",
          Object: [{ QualifyingProperties: [qualifyingProperties] }],
          KeyInfo: [{ X509Data: [{
            X509Certificate: [{ _: certificateBody(input.certificate) }],
            X509SubjectName: [{ _: input.certificateMetadata.subject }],
            X509IssuerSerial: [{
              X509IssuerName: [{ _: input.certificateMetadata.issuer }],
              X509SerialNumber: [{ _: input.certificateMetadata.serialNumber }],
            }],
          }] }],
          SignatureValue: [{ _: input.signatureValue }],
          SignedInfo: [{
            SignatureMethod: [{ _: "", Algorithm: SIGNATURE_ALGORITHM }],
            Reference: [
              { Type: SIGNED_PROPERTIES_TYPE, URI: "#id-xades-signed-props", DigestMethod: [{ _: "", Algorithm: DIGEST_ALGORITHM }], DigestValue: [{ _: propsDigest }] },
              { Type: "", URI: "", DigestMethod: [{ _: "", Algorithm: DIGEST_ALGORITHM }], DigestValue: [{ _: input.docDigest }] },
            ],
          }],
        }],
      }] }] }],
    }] }],
    documentSignature: [{ ID: [{ _: SIGNATURE_URN }], SignatureMethod: [{ _: EXTENSION_URN }] }],
  };
}

export class MyInvoisJsonSigningAdapter {
  constructor(private readonly secrets: SecretProvider, private readonly now: () => Date = () => new Date()) {}

  async inspectCertificate(connection: MyInvoisConnectionRecord, at = this.now()): Promise<SigningCertificateMetadata> {
    const { certificate, chainPem } = await this.material(connection);
    const result = metadata(certificate, at);
    assertChain(certificate, chainPem);
    return result;
  }

  async signPayload(snapshot: EInvoicePayloadSnapshotRecord, connection: MyInvoisConnectionRecord, timestampInput: string): Promise<MyInvoisSigningResult> {
    if (snapshot.businessId !== connection.businessId) {
      throw new MyInvoisSigningError("signing.business_mismatch", "The payload snapshot and connection belong to different businesses.");
    }
    if (!connection.enabled) {
      throw new MyInvoisSigningError("signing.connection_unavailable", "An enabled intermediary connection is required for signing.");
    }
    if (createHash("sha256").update(snapshot.unsignedPayload, "utf8").digest("hex") !== snapshot.unsignedPayloadHash) {
      throw new MyInvoisSigningError("payload.hash_mismatch", "The unsigned snapshot hash does not match its exact stored bytes.");
    }
    const signingTimestamp = new Date(timestampInput);
    if (!Number.isFinite(signingTimestamp.valueOf())) throw new MyInvoisSigningError("signing.timestamp_invalid", "Use a valid signing timestamp.");
    const normalizedTimestamp = signingTimestamp.toISOString().replace(".000Z", "Z");
    const { root, invoice } = unsignedInvoice(snapshot.unsignedPayload);
    const { certificate, privateKeyPem, passphrase, chainPem } = await this.material(connection);
    const certificateMetadata = metadata(certificate, signingTimestamp);
    assertChain(certificate, chainPem);
    const privateKey = createPrivateKey({ key: privateKeyPem, format: "pem", passphrase });
    if (!certificate.checkPrivateKey(privateKey)) {
      throw new MyInvoisSigningError("certificate.key_mismatch", "The configured private key does not match the signing certificate.");
    }
    const docDigestBytes = sha256(snapshot.unsignedPayload);
    const signatureValue = sign("RSA-SHA256", Buffer.from(snapshot.unsignedPayload, "utf8"), privateKey).toString("base64");
    const elements = signingElements({
      signingTimestamp: normalizedTimestamp,
      certDigest: sha256(certificate.raw).toString("base64"),
      certificate,
      certificateMetadata,
      docDigest: docDigestBytes.toString("base64"),
      signatureValue,
    });
    invoice.UBLExtensions = elements.extension;
    invoice.Signature = elements.documentSignature;
    const signedPayload = JSON.stringify(root);
    if (!verify("RSA-SHA256", Buffer.from(snapshot.unsignedPayload, "utf8"), certificate.publicKey, Buffer.from(signatureValue, "base64"))) {
      throw new MyInvoisSigningError("signature.verification_failed", "The generated signature could not be verified.");
    }
    return {
      signedPayload,
      signedPayloadHash: createHash("sha256").update(signedPayload, "utf8").digest("hex"),
      signingTimestamp: normalizedTimestamp,
      signingAlgorithm: "RSA-SHA256",
      implementationVersion: MYINVOIS_JSON_SIGNER_VERSION,
      certificate: certificateMetadata,
    };
  }

  private async material(connection: MyInvoisConnectionRecord) {
    if (!connection.signingCertificateSecretRef || !connection.signingPrivateKeySecretRef) {
      throw new MyInvoisSigningError("certificate.not_configured", "Digital signing is not configured for this MyInvois connection.");
    }
    const [certificatePem, privateKeyPem, passphrase, chainPem] = await Promise.all([
      this.secrets.resolve(connection.signingCertificateSecretRef, connection.environment),
      this.secrets.resolve(connection.signingPrivateKeySecretRef, connection.environment),
      connection.signingKeyPassphraseSecretRef ? this.secrets.resolve(connection.signingKeyPassphraseSecretRef, connection.environment) : undefined,
      connection.signingCertificateChainSecretRef ? this.secrets.resolve(connection.signingCertificateChainSecretRef, connection.environment) : undefined,
    ]);
    let certificate: X509Certificate;
    try { certificate = new X509Certificate(certificatePem); }
    catch { throw new MyInvoisSigningError("certificate.invalid", "The configured signing certificate is invalid."); }
    return { certificate, privateKeyPem, passphrase, chainPem };
  }
}
