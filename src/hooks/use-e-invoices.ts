"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { EInvoicePreparationRecord, EInvoiceWorkspace, PreparationSupplementalFields } from "@/application/e-invoices";
import { queryKeys } from "@/lib/query/query-keys";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(body.error || "The e-Invoice request failed.");
  return body as T;
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

