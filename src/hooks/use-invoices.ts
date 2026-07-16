"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/query-keys";
import { services } from "@/services";
import type { Invoice } from "@/types";

type CreateInvoiceInput = Parameters<(typeof services.invoices)["create"]>[0];

async function invalidateInvoiceDependents(queryClient: ReturnType<typeof useQueryClient>, businessId: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.invoices.list(businessId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.reminders.list(businessId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(businessId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.loanReadiness(businessId) }),
  ]);
}

export function useInvoices(businessId: string) {
  return useQuery({
    queryKey: queryKeys.invoices.list(businessId),
    queryFn: () => services.invoices.initializeDemo(businessId),
  });
}

export function useInvoice(businessId: string, invoiceId: string) {
  return useQuery({
    queryKey: queryKeys.invoices.detail(businessId, invoiceId),
    queryFn: async () => {
      await services.invoices.initializeDemo(businessId);
      return services.invoices.getById(businessId, invoiceId);
    },
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInvoiceInput) => services.invoices.create(input),
    onSuccess: async (invoice) => {
      queryClient.setQueryData(queryKeys.invoices.detail(invoice.businessId, invoice.id), invoice);
      await invalidateInvoiceDependents(queryClient, invoice.businessId);
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invoice: Invoice) => services.invoices.update(invoice),
    onSuccess: async (invoice) => {
      queryClient.setQueryData(queryKeys.invoices.detail(invoice.businessId, invoice.id), invoice);
      await invalidateInvoiceDependents(queryClient, invoice.businessId);
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ businessId, invoiceId }: { businessId: string; invoiceId: string }) =>
      services.invoices.remove(businessId, invoiceId),
    onSuccess: async (_, { businessId, invoiceId }) => {
      queryClient.removeQueries({ queryKey: queryKeys.invoices.detail(businessId, invoiceId), exact: true });
      await invalidateInvoiceDependents(queryClient, businessId);
    },
  });
}
