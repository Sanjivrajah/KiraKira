"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/auth-provider";
import { queryKeys } from "@/lib/query/query-keys";
import { services } from "@/services";
import { createSupabaseBusiness, getSupabaseBusinessesForUser } from "@/services/business-context-service";
import type { BusinessInput } from "@/types";

export function useBusiness() {
  const { activeBusinessId, mode, session } = useAuth();
  const userId = session?.user.id ?? "";
  const businesses = useQuery({
    queryKey: queryKeys.businessForUser(userId),
    queryFn: async () => {
      if (mode === "demo") {
        const business = await services.businesses.getForUser(userId);
        return business ? [business] : [];
      }
      return getSupabaseBusinessesForUser(userId);
    },
    enabled: Boolean(userId),
  });
  const selected = businesses.data?.find((business) => business.id === activeBusinessId) ?? businesses.data?.[0] ?? null;
  return { ...businesses, data: selected };
}

export function useBusinesses() {
  const { mode, session } = useAuth();
  const userId = session?.user.id ?? "";
  return useQuery({
    queryKey: queryKeys.businessForUser(userId),
    queryFn: async () => {
      if (mode === "demo") {
        const business = await services.businesses.getForUser(userId);
        return business ? [business] : [];
      }
      return getSupabaseBusinessesForUser(userId);
    },
    enabled: Boolean(userId),
  });
}

export function useSaveBusiness() {
  const { mode, session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BusinessInput) => {
      if (!session) throw new Error("You must be signed in to save a business.");
      return mode === "demo"
        ? services.businesses.saveForUser(session.user.id, input)
        : createSupabaseBusiness(input);
    },
    onSuccess: (business) => {
      if (!session) return;
      queryClient.setQueryData(queryKeys.businessForUser(session.user.id), [business]);
      queryClient.setQueryData(queryKeys.business(business.id), business);
    },
  });
}
