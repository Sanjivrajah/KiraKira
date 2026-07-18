"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import type { LoanReadinessResult, LoanTerms } from "@/domain/loan-readiness";
import { queryKeys } from "@/lib/query/query-keys";

async function responseData(response: Promise<Response>): Promise<LoanReadinessResult> {
  const resolved = await response;
  const data: unknown = await resolved.json();
  if (!resolved.ok) throw new Error(typeof data === "object" && data && "error" in data ? String(data.error) : "Loan readiness is unavailable.");
  return data as LoanReadinessResult;
}

export function useLoanReadiness(businessId: string) {
  return useQuery({
    queryKey: queryKeys.loanReadiness(businessId),
    queryFn: () => responseData(fetch(`/api/loan-readiness?businessId=${encodeURIComponent(businessId)}`, { cache: "no-store" })),
    enabled: Boolean(businessId),
  });
}

export function useLoanSimulation(businessId: string) {
  return useMutation({
    mutationFn: (terms: LoanTerms) => responseData(fetch("/api/loan-readiness", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, terms }),
    })),
  });
}
