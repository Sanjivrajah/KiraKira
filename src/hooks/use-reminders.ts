"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/query-keys";
import { services } from "@/services";
import type { Invoice } from "@/types";

export function useReminders(businessId: string) {
  return useQuery({
    queryKey: queryKeys.reminders.list(businessId),
    queryFn: () => services.reminders.list(businessId),
    enabled: Boolean(businessId),
  });
}

export function useMarkReminderSent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ invoice, messagePreview, sentAt }: { invoice: Invoice; messagePreview: string; sentAt?: string }) =>
      services.reminders.markSent(invoice, messagePreview, sentAt),
    onSuccess: async (reminder) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.reminders.list(reminder.businessId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.invoices.list(reminder.businessId) }),
      ]);
    },
  });
}
