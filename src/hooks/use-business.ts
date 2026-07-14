"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/auth-provider";
import { queryKeys } from "@/lib/query/query-keys";
import { services } from "@/services";
import type { BusinessInput } from "@/types";

export function useBusiness() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  return useQuery({
    queryKey: queryKeys.businessForUser(userId),
    queryFn: () => services.businesses.getForUser(userId),
    enabled: Boolean(userId),
  });
}

export function useSaveBusiness() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BusinessInput) => {
      if (!session) throw new Error("You must be signed in to save a business.");
      return services.businesses.saveForUser(session.user.id, input);
    },
    onSuccess: (business) => {
      if (!session) return;
      queryClient.setQueryData(queryKeys.businessForUser(session.user.id), business);
      queryClient.setQueryData(queryKeys.business(business.id), business);
    },
  });
}
