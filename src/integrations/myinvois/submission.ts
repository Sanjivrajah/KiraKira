import { z } from "zod";
import type { MyInvoisConnectionRecord, MyInvoisStructuredError } from "@/application/e-invoices";
import type { MyInvoisIntermediaryOAuthClient } from "./auth";

const errorSchema: z.ZodType<MyInvoisStructuredError> = z.lazy(() => z.object({
  propertyName: z.string().nullish().transform((value) => value ?? undefined),
  propertyPath: z.string().nullish().transform((value) => value ?? undefined),
  errorCode: z.string().nullish().transform((value) => value ?? undefined),
  error: z.string().optional(),
  message: z.string().optional(),
  innerError: z.array(errorSchema).optional(),
}).transform((value) => ({
  propertyName: value.propertyName,
  propertyPath: value.propertyPath,
  errorCode: value.errorCode,
  message: value.error ?? value.message ?? "MyInvois returned an unspecified error.",
  innerErrors: value.innerError,
})));

const submitResponseSchema = z.object({
  submissionUID: z.string().min(1),
  acceptedDocuments: z.array(z.object({ uuid: z.string().min(1), invoiceCodeNumber: z.string().min(1) })).default([]),
  rejectedDocuments: z.array(z.object({ invoiceCodeNumber: z.string().min(1), error: errorSchema })).default([]),
});

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

export interface MyInvoisSubmissionTransportOptions {
  apiBaseUrls?: Record<"sandbox" | "production", string>;
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

export class MyInvoisSubmissionTransport {
  private readonly apiBaseUrls: Record<"sandbox" | "production", string>;

  constructor(private readonly oauth: MyInvoisIntermediaryOAuthClient, options: MyInvoisSubmissionTransportOptions = {}) {
    this.apiBaseUrls = options.apiBaseUrls ?? defaultApiBaseUrls;
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

  private async call<T>(connection: MyInvoisConnectionRecord, path: string, schema: z.ZodType<T>, init: RequestInit): Promise<MyInvoisTransportResponse<T>> {
    try {
      const response = await this.oauth.authorisedFetch(connection, new URL(path, this.apiBaseUrls[connection.environment]), init);
      const body: unknown = await response.json().catch(() => null);
      const common = { httpStatus: response.status, correlationId: correlationId(response), retryAfterSeconds: retryAfter(response), rawResponse: body };
      if (!response.ok) return { ...common, error: structuredError(body) };
      const parsed = schema.safeParse(body);
      if (!parsed.success) return { ...common, error: { errorCode: "invalid_response", message: "MyInvois returned an unexpected response shape." } };
      return { ...common, data: parsed.data };
    } catch {
      return { httpStatus: 0, error: { errorCode: "transport_error", message: "MyInvois could not be reached." } };
    }
  }
}
