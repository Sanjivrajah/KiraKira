"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/query-keys";
import { services } from "@/services";

export function useDashboardSummary(businessId: string) {
  return useQuery({
    queryKey: queryKeys.dashboard(businessId),
    queryFn: async () => {
      await Promise.all([
        services.transactions.initializeDemo(businessId),
        services.invoices.initializeDemo(businessId),
      ]);
      return services.dashboard.getSummary(businessId);
    },
  });
}
