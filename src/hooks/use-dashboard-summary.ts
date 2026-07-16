"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/auth-provider";
import { queryKeys } from "@/lib/query/query-keys";
import { services } from "@/services";

export function useDashboardSummary(businessId: string, referenceDate: Date) {
  const { mode } = useAuth();
  return useQuery({
    queryKey: queryKeys.dashboard(businessId),
    queryFn: async () => {
      if (mode === "demo") {
        await Promise.all([
          services.transactions.initializeDemo(businessId),
          services.invoices.initializeDemo(businessId),
        ]);
      }
      return services.dashboard.getSummary(businessId, referenceDate);
    },
  });
}
