import { z } from "zod";
import type { MyInvoisConnectionRecord, MyInvoisStructuredError } from "@/application/e-invoices";
import type { MyInvoisOAuthClient } from "./auth";

const errorSchema: z.ZodType<MyInvoisStructuredError> = z.lazy(() => z.object({
  propertyName: z.string().nullish().transform((value) => value ?? undefined),
  propertyPath: z.string().nullish().transform((value) => value ?? undefined),
  errorCode: z.string().nullish().transform((value) => value ?? undefined),
  code: z.string().nullish().transform((value) => value ?? undefined),
  target: z.string().nullish().transform((value) => value ?? undefined),
  error: z.string().optional(),
  message: z.string().optional(),
  innerError: z.array(errorSchema).optional(),
  details: z.array(errorSchema).optional(),
}).transform((value) => ({
  propertyName: value.propertyName ?? value.target,
  propertyPath: value.propertyPath,
  errorCode: value.errorCode ?? value.code,
  message: value.error ?? value.message ?? "MyInvois returned an unspecified error.",
  innerErrors: value.innerError ?? value.details,
})));

const submitResponseSchema = z.object({
  submissionUID: z.string().min(1).nullish(),
  submissionUid: z.string().min(1).nullish(),
  acceptedDocuments: z.array(z.object({ uuid: z.string().min(1), invoiceCodeNumber: z.string().min(1) })).default([]),
  rejectedDocuments: z.array(z.object({ invoiceCodeNumber: z.string().min(1), error: errorSchema })).default([]),
}).transform((value) => ({
  submissionUID: value.submissionUID ?? value.submissionUid ?? undefined,
  acceptedDocuments: value.acceptedDocuments,
  rejectedDocuments: value.rejectedDocuments,
}));

const documentSummarySchema = z.object({
  uuid: z.string().min(1),
  longId: z.string().nullish(),
  internalId: z.string().min(1),
  status: z.string().min(1),
});

const getSubmissionSchema = z.object({
  submissionUid: z.string().min(1),
  documentCount: z.number().int().nonnegative(),
  overallStatus: z.string().min(1),
  documentSummary: z.array(documentSummarySchema).default([]),
});

const documentDetailsSchema = z.object({
  uuid: z.string().min(1),
  longId: z.string().nullish(),
  internalId: z.string().min(1),
  status: z.string().min(1),
  validationResults: z.unknown().optional(),
});

const cancellationResponseSchema = z.object({
  uuid: z.string().min(1),
  status: z.string().min(1),
});

export interface MyInvoisSubmissionTransportOptions {
  apiBaseUrls?: Record<"sandbox" | "production", string>;
  timeoutMs?: number;
  maxResponseBytes?: number;
}

export interface MyInvoisTransportResponse<T> {
  httpStatus: number;
  correlationId?: string;
  retryAfterSeconds?: number;
  data?: T;
  error?: MyInvoisStructuredError;
  rawResponse?: unknown;
}

const defaultApiBaseUrls = {
  sandbox: "https://preprod-api.myinvois.hasil.gov.my",
  production: "https://api.myinvois.hasil.gov.my",
};

function retryAfter(response: Response): number | undefined {
  const value = Number(response.headers.get("retry-after"));
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

function correlationId(response: Response): string | undefined {
  return response.headers.get("correlation-id") ?? response.headers.get("x-correlation-id") ?? response.headers.get("request-id") ?? undefined;
}

function structuredError(value: unknown): MyInvoisStructuredError {
  const candidate = value && typeof value === "object" && "error" in value ? (value as { error: unknown }).error : value;
  return errorSchema.safeParse(candidate).data ?? { message: "MyInvois returned an invalid error response." };
}

function safeBoundaryError(error: unknown): MyInvoisStructuredError | null {
  if (!error || typeof error !== "object" || !("code" in error) || typeof error.code !== "string") return null;
  if (!/^(auth|connection|secret)\./.test(error.code)) return null;
  return {
    errorCode: error.code,
    message: error instanceof Error ? error.message : "The server-side MyInvois connection is not configured correctly.",
  };
}

export class MyInvoisSubmissionTransport {
  private readonly apiBaseUrls: Record<"sandbox" | "production", string>;
  private readonly timeoutMs: number;
  private readonly maxResponseBytes: number;

  constructor(private readonly oauth: MyInvoisOAuthClient, options: MyInvoisSubmissionTransportOptions = {}) {
    this.apiBaseUrls = options.apiBaseUrls ?? defaultApiBaseUrls;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxResponseBytes = options.maxResponseBytes ?? 1024 * 1024;
  }

  async submit(connection: MyInvoisConnectionRecord, requestBody: string) {
    return this.call(connection, "/api/v1.0/documentsubmissions/", submitResponseSchema, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: requestBody,
      cache: "no-store",
    });
  }

  async getSubmission(connection: MyInvoisConnectionRecord, submissionUid: string) {
    const path = `/api/v1.0/documentsubmissions/${encodeURIComponent(submissionUid)}?pageNo=1&pageSize=100`;
    return this.call(connection, path, getSubmissionSchema, { method: "GET", cache: "no-store" });
  }

  async getDocumentDetails(connection: MyInvoisConnectionRecord, uuid: string) {
    const path = `/api/v1.0/documents/${encodeURIComponent(uuid)}/details`;
    return this.call(connection, path, documentDetailsSchema, { method: "GET", cache: "no-store" });
  }

  async cancelDocument(connection: MyInvoisConnectionRecord, uuid: string, reason: string) {
    const path = `/api/v1.0/documents/state/${encodeURIComponent(uuid)}/state`;
    return this.call(connection, path, cancellationResponseSchema, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled", reason }), cache: "no-store",
    });
  }

  private async call<T>(connection: MyInvoisConnectionRecord, path: string, schema: z.ZodType<T>, init: RequestInit): Promise<MyInvoisTransportResponse<T>> {
    try {
      const response = await this.oauth.authorisedFetch(connection, new URL(path, this.apiBaseUrls[connection.environment]), {
        ...init, signal: AbortSignal.timeout(this.timeoutMs),
      });
      const declaredSize = Number(response.headers.get("content-length"));
      if (Number.isFinite(declaredSize) && declaredSize > this.maxResponseBytes) {
        return { httpStatus: response.status, correlationId: correlationId(response), error: { errorCode: "response_too_large", message: "MyInvois returned an oversized response." } };
      }
      const raw = await response.text();
      if (new TextEncoder().encode(raw).byteLength > this.maxResponseBytes) {
        return { httpStatus: response.status, correlationId: correlationId(response), error: { errorCode: "response_too_large", message: "MyInvois returned an oversized response." } };
      }
      const body: unknown = raw ? (() => { try { return JSON.parse(raw) as unknown; } catch { return null; } })() : null;
      const common = { httpStatus: response.status, correlationId: correlationId(response), retryAfterSeconds: retryAfter(response), rawResponse: body };
      if (!response.ok) return { ...common, error: structuredError(body) };
      const parsed = schema.safeParse(body);
      if (!parsed.success) return { ...common, error: { errorCode: "invalid_response", message: "MyInvois returned an unexpected response shape." } };
      return { ...common, data: parsed.data };
    } catch (error) {
      const boundaryError = safeBoundaryError(error);
      const status = error && typeof error === "object" && "status" in error && typeof error.status === "number"
        ? error.status
        : 0;
      return boundaryError
        ? { httpStatus: status, error: boundaryError }
        : { httpStatus: 0, error: { errorCode: "transport_error", message: "MyInvois could not be reached." } };
    }
  }
}
