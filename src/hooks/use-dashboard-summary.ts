"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/query-keys";
import { services } from "@/services";

export function useDashboardSummary(businessId: string, referenceDate: Date) {
  return useQuery({
    queryKey: queryKeys.dashboard(businessId),
    queryFn: async () => {
      try {
        await Promise.all([
          services.transactions.initializeDemo(businessId),
          services.invoices.initializeDemo(businessId),
        ]);
        return await services.dashboard.getSummary(businessId, referenceDate);
      } catch (err) {
        console.error("[useDashboardSummary] Error fetching dashboard data:", err);
        throw err;
      }
    },
  });
}
