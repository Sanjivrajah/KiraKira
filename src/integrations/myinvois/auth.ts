import "server-only";
import { z } from "zod";
import type { MyInvoisConnectionRecord, MyInvoisEnvironment } from "@/application/e-invoices";
import type { SecretProvider } from "./secrets";

const taxpayerTinSchema = z.string().trim().regex(/^[A-Z]{1,2}[0-9]{8,14}$/, "Use a valid Malaysian TIN.");
const robSchema = z.string().trim().regex(/^[A-Z0-9-]{1,30}$/, "Use a valid ROB registration value.");

export function taxpayerIdentity(input: {
  taxpayerTin: string;
  taxpayerRegistrationScheme?: string;
  taxpayerRegistrationValue?: string;
}): string {
  const tin = taxpayerTinSchema.parse(input.taxpayerTin.toUpperCase());
  if (!input.taxpayerRegistrationScheme && !input.taxpayerRegistrationValue) return tin;
  if (input.taxpayerRegistrationScheme !== "ROB" || !input.taxpayerRegistrationValue) {
    throw new Error("A represented registration must use the ROB scheme and value.");
  }
  return `${tin}:${robSchema.parse(input.taxpayerRegistrationValue.toUpperCase())}`;
}

export interface MyInvoisAccessToken {
  accessToken: string;
  tokenType: "Bearer";
  expiresAt: number;
}

interface CachedToken extends MyInvoisAccessToken {
  refreshAfter: number;
}

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export class MyInvoisAuthenticationError extends Error {
  constructor(readonly code: string, message: string, readonly status?: number) {
    super(message);
    this.name = "MyInvoisAuthenticationError";
  }
}

export interface MyInvoisOAuthClientOptions {
  fetch?: FetchLike;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
  maxAttempts?: number;
  refreshSkewSeconds?: number;
  identityBaseUrls?: Record<MyInvoisEnvironment, string>;
}

const defaultBaseUrls: Record<MyInvoisEnvironment, string> = {
  sandbox: "https://preprod-api.myinvois.hasil.gov.my",
  production: "https://api.myinvois.hasil.gov.my",
};

export class MyInvoisIntermediaryOAuthClient {
  private readonly cache = new Map<string, CachedToken>();
  private readonly pending = new Map<string, Promise<CachedToken>>();
  private readonly fetch: FetchLike;
  private readonly now: () => number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly random: () => number;
  private readonly maxAttempts: number;
  private readonly refreshSkewSeconds: number;
  private readonly identityBaseUrls: Record<MyInvoisEnvironment, string>;

  constructor(private readonly secrets: SecretProvider, options: MyInvoisOAuthClientOptions = {}) {
    this.fetch = options.fetch ?? fetch;
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.random = options.random ?? Math.random;
    this.maxAttempts = options.maxAttempts ?? 3;
    this.refreshSkewSeconds = options.refreshSkewSeconds ?? 120;
    this.identityBaseUrls = options.identityBaseUrls ?? defaultBaseUrls;
  }

  private key(connection: MyInvoisConnectionRecord): string {
    return [connection.environment, connection.authMode, connection.credentialSetId, connection.businessId, connection.onbehalfofValue].join(":");
  }

  invalidate(connection: MyInvoisConnectionRecord): void {
    this.cache.delete(this.key(connection));
  }

  async accessToken(connection: MyInvoisConnectionRecord, forceRefresh = false): Promise<MyInvoisAccessToken> {
    if (!connection.enabled) throw new MyInvoisAuthenticationError("connection.disabled", "The MyInvois connection is disabled.");
    const expectedIdentity = taxpayerIdentity(connection);
    if (connection.authMode === "intermediary" && expectedIdentity !== connection.onbehalfofValue) {
      throw new MyInvoisAuthenticationError("connection.identity_mismatch", "The represented taxpayer identity does not match the selected business connection.");
    }
    const key = this.key(connection);
    const cached = this.cache.get(key);
    if (!forceRefresh && cached && cached.refreshAfter > this.now()) return cached;
    const inFlight = this.pending.get(key);
    if (inFlight) return inFlight;
    const request = this.login(connection).finally(() => this.pending.delete(key));
    this.pending.set(key, request);
    const token = await request;
    this.cache.set(key, token);
    return token;
  }

  async authorisedFetch(connection: MyInvoisConnectionRecord, input: string | URL, init: RequestInit = {}): Promise<Response> {
    let token = await this.accessToken(connection);
    let response = await this.fetch(input, { ...init, headers: { ...Object.fromEntries(new Headers(init.headers)), Authorization: `${token.tokenType} ${token.accessToken}` } });
    if (response.status !== 401) return response;
    this.invalidate(connection);
    token = await this.accessToken(connection, true);
    response = await this.fetch(input, { ...init, headers: { ...Object.fromEntries(new Headers(init.headers)), Authorization: `${token.tokenType} ${token.accessToken}` } });
    return response;
  }

  private async login(connection: MyInvoisConnectionRecord): Promise<CachedToken> {
    const [clientId, clientSecret] = await Promise.all([
      this.secrets.resolve(connection.clientIdSecretRef, connection.environment),
      this.secrets.resolve(connection.clientSecretSecretRef, connection.environment),
    ]);
    const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials", scope: "InvoicingAPI" });
    for (let attempt = 0; attempt < this.maxAttempts; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetch(new URL("/connect/token", this.identityBaseUrls[connection.environment]), {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            ...(connection.authMode === "intermediary" ? { onbehalfof: connection.onbehalfofValue } : {}),
          },
          body,
          cache: "no-store",
        });
      } catch {
        if (attempt + 1 >= this.maxAttempts) throw new MyInvoisAuthenticationError("auth.unavailable", "MyInvois authentication is temporarily unavailable.");
        await this.backoff(attempt);
        continue;
      }
      if (response.ok) {
        const parsed = z.object({ access_token: z.string().min(1), token_type: z.literal("Bearer"), expires_in: z.number().int().positive() }).safeParse(await response.json().catch(() => null));
        if (!parsed.success) throw new MyInvoisAuthenticationError("auth.invalid_response", "MyInvois returned an invalid authentication response.", response.status);
        const issuedAt = this.now();
        const expiresAt = issuedAt + parsed.data.expires_in * 1000;
        return {
          accessToken: parsed.data.access_token,
          tokenType: parsed.data.token_type,
          expiresAt,
          refreshAfter: Math.max(issuedAt, expiresAt - this.refreshSkewSeconds * 1000),
        };
      }
      if (![429, 500, 502, 503, 504].includes(response.status) || attempt + 1 >= this.maxAttempts) {
        throw new MyInvoisAuthenticationError(
          response.status === 429 ? "auth.throttled" : "auth.rejected",
          response.status === 429 ? "MyInvois login is rate limited. Try again later." : "MyInvois rejected the configured intermediary credentials or delegation.",
          response.status,
        );
      }
      const retryAfter = Number(response.headers.get("retry-after"));
      if (Number.isFinite(retryAfter) && retryAfter >= 0) await this.sleep(retryAfter * 1000);
      else await this.backoff(attempt);
    }
    throw new MyInvoisAuthenticationError("auth.unavailable", "MyInvois authentication is temporarily unavailable.");
  }

  private backoff(attempt: number): Promise<void> {
    return this.sleep(Math.round(250 * 2 ** attempt * (0.75 + this.random() * 0.5)));
  }
}
