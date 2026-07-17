"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { EInvoicePreparationRecord, EInvoiceSubmissionHistoryFilter, EInvoiceSubmissionRecord, EInvoiceWorkspace, PreparationSupplementalFields } from "@/application/e-invoices";
import { queryKeys } from "@/lib/query/query-keys";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(body.error || "The e-Invoice request failed.");
  return body as T;
}

export interface EInvoiceSubmissionWorkspace {
  environment: "sandbox" | "production";
  taxpayerIdentity?: string;
  productionReady: boolean;
  candidates: Array<{
    payloadSnapshotId: string;
    eInvoiceDocumentId: string;
    invoiceCodeNumber: string;
    encodedSizeBytes: number;
    documentVersion: "1.0";
    scenario: string;
    productionEligible: boolean;
    ineligibilityReason?: string;
  }>;
  submissions: EInvoiceSubmissionRecord[];
  nextCursor?: string;
  attention: EInvoiceSubmissionRecord[];
  summary: { needsAttention: number; readyToSubmit: number; inProgress: number };
}

function submissionPost<T>(body: Record<string, unknown>) {
  return request<T>("/api/e-invoices/submissions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

function submissionWorkspaceUrl(businessId: string, environment: "sandbox" | "production", filter: EInvoiceSubmissionHistoryFilter, cursor?: string) {
  const search = new URLSearchParams({ businessId, environment, filter, limit: "25" });
  if (cursor) search.set("cursor", cursor);
  return `/api/e-invoices/submissions?${search.toString()}`;
}

export function useEInvoiceSubmissions(businessId: string, environment: "sandbox" | "production" = "sandbox", filter: EInvoiceSubmissionHistoryFilter = "all", enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.eInvoices.submissions(businessId), environment, filter, "first"],
    queryFn: () => request<EInvoiceSubmissionWorkspace>(submissionWorkspaceUrl(businessId, environment, filter)),
    enabled: enabled && Boolean(businessId),
  });
}

export function useEInvoiceSubmissionHistory(businessId: string, environment: "sandbox" | "production", filter: EInvoiceSubmissionHistoryFilter, enabled = true) {
  return useInfiniteQuery({
    queryKey: [...queryKeys.eInvoices.submissions(businessId), environment, filter, "history"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => request<EInvoiceSubmissionWorkspace>(submissionWorkspaceUrl(businessId, environment, filter, pageParam)),
    getNextPageParam: (page) => page.nextCursor,
    enabled: enabled && Boolean(businessId),
  });
}

function useSubmissionMutation<TInput extends { businessId: string }, TResult>(mutationFn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn, onSuccess: async (_, input) => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.eInvoices.submissions(input.businessId) });
  } });
}

export function useSubmitEInvoices() {
  return useSubmissionMutation((input: { businessId: string; environment: "sandbox" | "production"; payloadSnapshotIds: string[]; confirmation?: string }) =>
    submissionPost<{ result: EInvoiceSubmissionRecord }>({ action: "submit", ...input }));
}

export function useGenerateEInvoiceSandboxPayload() {
  return useSubmissionMutation((input: { businessId: string; documentId: string }) =>
    submissionPost({ action: "generate_v1_0", ...input }));
}

export function useRefreshEInvoiceSubmission() {
  return useSubmissionMutation((input: { businessId: string; submissionId: string }) =>
    submissionPost<{ result: EInvoiceSubmissionRecord }>({ action: "refresh", ...input }));
}

export function useCancelEInvoiceDocument() {
  return useSubmissionMutation((input: { businessId: string; submissionId: string; eInvoiceDocumentId: string; reason: string }) =>
    submissionPost<{ result: EInvoiceSubmissionRecord }>({ action: "cancel", confirmation: "CANCEL MYINVOIS DOCUMENT", ...input }));
}

function post<T>(body: Record<string, unknown>) {
  return request<T>("/api/e-invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export function useEInvoiceWorkspace(businessId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.eInvoices.workspace(businessId),
    queryFn: () => request<EInvoiceWorkspace>(`/api/e-invoices?businessId=${encodeURIComponent(businessId)}`),
    enabled: enabled && Boolean(businessId),
  });
}

function useWorkspaceMutation<TInput extends { businessId: string }>(mutationFn: (input: TInput) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async (_, input) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.eInvoices.workspace(input.businessId) });
    },
  });
}

export function usePrepareEInvoices() {
  return useWorkspaceMutation(({ businessId, invoiceIds }: { businessId: string; invoiceIds: string[] }) =>
    post<{ result: EInvoicePreparationRecord[] }>({ action: "prepare", businessId, invoiceIds }));
}

export function useSaveEInvoiceFields() {
  return useWorkspaceMutation((input: { businessId: string; documentId: string; expectedRevision: number; fields: PreparationSupplementalFields }) =>
    post<{ result: EInvoicePreparationRecord }>({ action: "save_fields", ...input }));
}

export function useApproveEInvoice() {
  return useWorkspaceMutation((input: { businessId: string; documentId: string; expectedRevision: number }) =>
    post<{ result: EInvoicePreparationRecord }>({ action: "approve", ...input }));
}

export function useCreateEInvoiceRevision() {
  return useWorkspaceMutation((input: { businessId: string; documentId: string }) =>
    post<{ result: EInvoicePreparationRecord }>({ action: "create_revision", ...input }));
}
