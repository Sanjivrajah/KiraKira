import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { EInvoicePayloadSnapshotRecord, MyInvoisConnectionRecord } from "@/application/e-invoices";
import type { SecretProvider } from "./secrets";
import { MyInvoisJsonSigningAdapter } from "./signing";

function createCertificate(commonName: string) {
  const directory = mkdtempSync(join(tmpdir(), "kirakira-signing-"));
  const key = join(directory, "key.pem");
  const certificate = join(directory, "certificate.pem");
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-keyout", key, "-out", certificate, "-days", "2", "-nodes", "-subj", `/C=MY/O=Niaga Test/CN=${commonName}`], { stdio: "ignore" });
  return { key: readFileSync(key, "utf8"), certificate: readFileSync(certificate, "utf8") };
}

const unsignedPayload = JSON.stringify({
  _D: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
  _A: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
  _B: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
  Invoice: [{ ID: [{ _: "INV-STAGE-4" }], InvoiceTypeCode: [{ _: "01", listVersionID: "1.1" }] }],
});

const snapshot: EInvoicePayloadSnapshotRecord = {
  id: "snapshot-1",
  businessId: "business-1",
  eInvoiceDocumentId: "document-1",
  documentRevision: 1,
  documentVersion: "1.1",
  mapperVersion: "invoice-v1.1.1",
  referenceDataVersion: "test",
  format: "json",
  unsignedPayload,
  unsignedPayloadHash: createHash("sha256").update(unsignedPayload).digest("hex"),
  payloadSizeBytes: Buffer.byteLength(unsignedPayload),
  generatedAt: "2026-07-17T00:00:00Z",
};

const connection: MyInvoisConnectionRecord = {
  id: "connection-1", businessId: "business-1", environment: "sandbox", authMode: "intermediary",
  taxpayerTin: "C25845632020", onbehalfofValue: "C25845632020", credentialSetId: "main",
  clientIdSecretRef: "client", clientSecretSecretRef: "client-secret",
  signingCertificateSecretRef: "certificate", signingPrivateKeySecretRef: "key", enabled: true,
  createdAt: "2026-07-17T00:00:00Z", updatedAt: "2026-07-17T00:00:00Z",
};

class MemorySecrets implements SecretProvider {
  constructor(private readonly values: Record<string, string>) {}
  async resolve(reference: string) { return this.values[reference]; }
}

describe("MyInvois JSON digital signing", () => {
  it("embeds official UBL signature structures, verifies, and hashes exact stable bytes", async () => {
    const material = createCertificate("Signer One");
    const adapter = new MyInvoisJsonSigningAdapter(new MemorySecrets({ certificate: material.certificate, key: material.key }));
    const certificate = await adapter.inspectCertificate(connection);
    const signingTime = new Date(certificate.notBefore).getTime() + 60_000;
    const first = await adapter.signPayload(snapshot, connection, new Date(signingTime).toISOString());
    const second = await adapter.signPayload(snapshot, connection, new Date(signingTime).toISOString());
    const parsed = JSON.parse(first.signedPayload);

    expect(parsed.Invoice[0].UBLExtensions[0].UBLExtension[0].ExtensionURI[0]._)
      .toBe("urn:oasis:names:specification:ubl:dsig:enveloped:xades");
    expect(parsed.Invoice[0].Signature[0].ID[0]._)
      .toBe("urn:oasis:names:specification:ubl:signature:Invoice");
    expect(first.signedPayload).toBe(second.signedPayload);
    expect(first.signedPayloadHash).toBe(createHash("sha256").update(first.signedPayload).digest("hex"));
    expect(first.certificate.thumbprintSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("fails closed for cross-business snapshots, altered bytes, expiry, and invalid chains", async () => {
    const material = createCertificate("Signer Two");
    const wrongIssuer = createCertificate("Wrong Issuer");
    const adapter = new MyInvoisJsonSigningAdapter(new MemorySecrets({ certificate: material.certificate, key: material.key, chain: wrongIssuer.certificate }));
    const certificate = await new MyInvoisJsonSigningAdapter(new MemorySecrets({ certificate: material.certificate, key: material.key })).inspectCertificate(connection);
    const validTime = new Date(certificate.notBefore).getTime() + 60_000;
    await expect(adapter.signPayload({ ...snapshot, businessId: "other-business" }, connection, new Date(validTime).toISOString()))
      .rejects.toMatchObject({ code: "signing.business_mismatch" });
    await expect(adapter.signPayload({ ...snapshot, unsignedPayload: `${unsignedPayload} ` }, connection, new Date(validTime).toISOString()))
      .rejects.toMatchObject({ code: "payload.hash_mismatch" });
    await expect(new MyInvoisJsonSigningAdapter(new MemorySecrets({ certificate: material.certificate, key: material.key }))
      .signPayload(snapshot, connection, new Date(new Date(certificate.notAfter).getTime() + 1).toISOString()))
      .rejects.toMatchObject({ code: "certificate.expired" });
    await expect(adapter.inspectCertificate({ ...connection, signingCertificateChainSecretRef: "chain" }, new Date(validTime)))
      .rejects.toMatchObject({ code: "certificate.chain_invalid" });
  });
});

