"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/query-keys";
import { services } from "@/services";
import type { Transaction } from "@/types";

type CreateTransactionInput = Parameters<(typeof services.transactions)["create"]>[0];

async function invalidateTransactionDependents(queryClient: ReturnType<typeof useQueryClient>, businessId: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.transactions.list(businessId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(businessId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.loanReadiness(businessId) }),
  ]);
}

export function useTransactions(businessId: string) {
  return useQuery({
    queryKey: queryKeys.transactions.list(businessId),
    queryFn: () => services.transactions.initializeDemo(businessId),
  });
}

export function useTransaction(businessId: string, transactionId: string) {
  return useQuery({
    queryKey: queryKeys.transactions.detail(businessId, transactionId),
    queryFn: async () => {
      await services.transactions.initializeDemo(businessId);
      return services.transactions.getById(businessId, transactionId);
    },
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTransactionInput) => services.transactions.create(input),
    onSuccess: async (transaction) => {
      queryClient.setQueryData(queryKeys.transactions.detail(transaction.businessId, transaction.id), transaction);
      await invalidateTransactionDependents(queryClient, transaction.businessId);
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transaction: Transaction) => services.transactions.update(transaction),
    onSuccess: async (transaction) => {
      queryClient.setQueryData(queryKeys.transactions.detail(transaction.businessId, transaction.id), transaction);
      await invalidateTransactionDependents(queryClient, transaction.businessId);
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ businessId, transactionId }: { businessId: string; transactionId: string }) =>
      services.transactions.remove(businessId, transactionId),
    onSuccess: async (_, { businessId, transactionId }) => {
      queryClient.removeQueries({ queryKey: queryKeys.transactions.detail(businessId, transactionId), exact: true });
      await invalidateTransactionDependents(queryClient, businessId);
    },
  });
}
