import { describe, expect, it, vi } from "vitest";
import type { MyInvoisConnectionRecord } from "@/application/e-invoices";
import { MyInvoisOAuthClient, taxpayerIdentity } from "./auth";
import { EnvironmentSecretProvider } from "./secrets";
import type { SecretProvider } from "./secrets";

const connection: MyInvoisConnectionRecord = {
  id: "connection-1",
  businessId: "business-1",
  environment: "sandbox",
  authMode: "intermediary",
  taxpayerTin: "C25845632020",
  taxpayerRegistrationScheme: "ROB",
  taxpayerRegistrationValue: "201901234567",
  onbehalfofValue: "C25845632020:201901234567",
  credentialSetId: "intermediary-main",
  clientIdSecretRef: "client-id",
  clientSecretSecretRef: "client-secret",
  enabled: true,
  documentVersion: "1.0",
  createdAt: "2026-07-17T00:00:00Z",
  updatedAt: "2026-07-17T00:00:00Z",
};

class MemorySecrets implements SecretProvider {
  async resolve(reference: string, environment: "sandbox" | "production") {
    if (environment !== "sandbox") throw new Error("wrong environment");
    return reference === "client-id" ? "secret-client-id" : "secret-client-secret";
  }
}

function tokenResponse(token = "sensitive-token", expiresIn = 3600) {
  return new Response(JSON.stringify({ access_token: token, token_type: "Bearer", expires_in: expiresIn }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("MyInvois OAuth authentication", () => {
  it("validates TIN and TIN:ROB identities", () => {
    expect(taxpayerIdentity({ taxpayerTin: "C25845632020" })).toBe("C25845632020");
    expect(taxpayerIdentity(connection)).toBe("C25845632020:201901234567");
    expect(() => taxpayerIdentity({ taxpayerTin: "invalid" })).toThrow();
  });

  it("derives onbehalfof from the selected connection and never accepts a caller override", async () => {
    const fetch = vi.fn().mockResolvedValue(tokenResponse());
    const client = new MyInvoisOAuthClient(new MemorySecrets(), { fetch });
    await client.accessToken(connection);
    const [, init] = fetch.mock.calls[0];
    expect(new Headers(init.headers).get("onbehalfof")).toBe(connection.onbehalfofValue);
    expect(String(init.body)).toContain("grant_type=client_credentials");
  });

  it("uses taxpayer-system credentials without an onbehalfof header", async () => {
    const fetch = vi.fn().mockResolvedValue(tokenResponse());
    const client = new MyInvoisOAuthClient(new MemorySecrets(), { fetch });
    await client.accessToken({ ...connection, authMode: "taxpayer" });
    const [, init] = fetch.mock.calls[0];
    expect(new Headers(init.headers).has("onbehalfof")).toBe(false);
    expect(String(init.body)).toContain("scope=InvoicingAPI");
  });

  it("caches tokens and collapses concurrent refreshes", async () => {
    let resolveResponse!: (response: Response) => void;
    const fetch = vi.fn(() => new Promise<Response>((resolve) => { resolveResponse = resolve; }));
    const client = new MyInvoisOAuthClient(new MemorySecrets(), { fetch });
    const requests = [client.accessToken(connection), client.accessToken(connection), client.accessToken(connection)];
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    resolveResponse(tokenResponse());
    const tokens = await Promise.all(requests);
    expect(tokens.map((item) => item.accessToken)).toEqual(["sensitive-token", "sensitive-token", "sensitive-token"]);
    await client.accessToken(connection);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("refreshes once after a 401 without exposing credentials in errors", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(tokenResponse("first"))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(tokenResponse("second"))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const client = new MyInvoisOAuthClient(new MemorySecrets(), { fetch });
    const response = await client.authorisedFetch(connection, "https://example.test/protected");
    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(new Headers(fetch.mock.calls[3][1]?.headers).get("Authorization")).toBe("Bearer second");

    const rejectedFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error_description: "secret-client-secret sensitive-token" }), { status: 400 }));
    const rejected = new MyInvoisOAuthClient(new MemorySecrets(), { fetch: rejectedFetch });
    await expect(rejected.accessToken(connection)).rejects.not.toThrow(/secret-client-secret|sensitive-token/);
  });

  it("rejects a connection whose stored delegation does not match its taxpayer fields", async () => {
    const fetch = vi.fn();
    const client = new MyInvoisOAuthClient(new MemorySecrets(), { fetch });
    await expect(client.accessToken({ ...connection, onbehalfofValue: "C99999999990" }))
      .rejects.toMatchObject({ code: "connection.identity_mismatch" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fails before secret access when sandbox and production references are mixed", async () => {
    await expect(new EnvironmentSecretProvider().resolve("env:production:MYINVOIS_CLIENT_ID", "sandbox"))
      .rejects.toMatchObject({ code: "secret.environment_mismatch" });
  });
});
