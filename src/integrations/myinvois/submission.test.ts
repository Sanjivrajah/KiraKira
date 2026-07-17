import { describe, expect, it, vi } from "vitest";
import type { MyInvoisConnectionRecord } from "@/application/e-invoices";
import type { MyInvoisOAuthClient } from "./auth";
import { MyInvoisSubmissionTransport } from "./submission";

const connection: MyInvoisConnectionRecord = {
  id: "connection-1", businessId: "business-1", environment: "sandbox", authMode: "taxpayer",
  taxpayerTin: "C25845632020", onbehalfofValue: "C25845632020", credentialSetId: "sandbox",
  clientIdSecretRef: "client", clientSecretSecretRef: "secret", enabled: true, documentVersion: "1.0",
  createdAt: "2026-07-18T00:00:00Z", updatedAt: "2026-07-18T00:00:00Z",
};

function oauth(response: Response) {
  return { authorisedFetch: vi.fn().mockResolvedValue(response) } as unknown as MyInvoisOAuthClient;
}

describe("MyInvois submission transport hardening", () => {
  it("uses the fixed v1.0 cancellation path and a bounded reason body", async () => {
    const client = oauth(new Response(JSON.stringify({ uuid: "UUID-1", status: "Cancelled" }), { status: 200 }));
    const transport = new MyInvoisSubmissionTransport(client);
    const result = await transport.cancelDocument(connection, "UUID-1", "Incorrect buyer details");
    const mock = vi.mocked(client.authorisedFetch);
    expect(String(mock.mock.calls[0][1])).toBe("https://preprod-api.myinvois.hasil.gov.my/api/v1.0/documents/state/UUID-1/state");
    expect(mock.mock.calls[0][2]).toMatchObject({ method: "PUT", body: JSON.stringify({ status: "cancelled", reason: "Incorrect buyer details" }) });
    expect(result.data).toEqual({ uuid: "UUID-1", status: "Cancelled" });
  });

  it("rejects oversized provider responses before schema processing", async () => {
    const client = oauth(new Response(JSON.stringify({ submissionUID: "SUB-1", acceptedDocuments: [], rejectedDocuments: [] }), {
      status: 202, headers: { "Content-Length": "9999" },
    }));
    const transport = new MyInvoisSubmissionTransport(client, { maxResponseBytes: 100 });
    const result = await transport.submit(connection, JSON.stringify({ documents: [] }));
    expect(result).toMatchObject({ error: { errorCode: "response_too_large" } });
  });

  it("preserves safe server-side authentication and secret errors", async () => {
    const client = {
      authorisedFetch: vi.fn().mockRejectedValue(Object.assign(
        new Error("A required MyInvois secret is not configured."),
        { code: "secret.not_configured" },
      )),
    } as unknown as MyInvoisOAuthClient;
    const result = await new MyInvoisSubmissionTransport(client)
      .submit(connection, JSON.stringify({ documents: [] }));

    expect(result).toEqual({
      httpStatus: 0,
      error: {
        errorCode: "secret.not_configured",
        message: "A required MyInvois secret is not configured.",
      },
    });
  });

  it("parses the live lower-camel all-rejected HTTP 202 response", async () => {
    const client = oauth(new Response(JSON.stringify({
      submissionUid: null,
      acceptedDocuments: [],
      rejectedDocuments: [{
        invoiceCodeNumber: "INV-1",
        error: {
          code: "3",
          message: "Validation Error",
          details: [{ code: null, target: "[0]", propertyPath: "#/Invoice[0].IssueTime[0]", message: "TimeExpected" }],
        },
      }],
    }), { status: 202 }));

    const result = await new MyInvoisSubmissionTransport(client)
      .submit(connection, JSON.stringify({ documents: [] }));

    expect(result.data).toEqual({
      submissionUID: undefined,
      acceptedDocuments: [],
      rejectedDocuments: [{
        invoiceCodeNumber: "INV-1",
        error: expect.objectContaining({
          errorCode: "3",
          message: "Validation Error",
          innerErrors: [expect.objectContaining({ propertyName: "[0]", propertyPath: "#/Invoice[0].IssueTime[0]", message: "TimeExpected" })],
        }),
      }],
    });
    expect(result.error).toBeUndefined();
  });
});
