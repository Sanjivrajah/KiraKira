"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LoadingState } from "@/components/shared/loading-state";
import { useBusiness } from "@/hooks/use-business";
import { useAuth } from "./auth-provider";

type Gate = "public-auth" | "onboarding" | "dashboard";

function safeDestination(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : null;
}

const fallback = <main className="route-loading"><LoadingState label="Restoring your session" /></main>;

export function AuthGate(props: { gate: Gate; children: ReactNode }) {
  return <Suspense fallback={fallback}><AuthGateContent {...props} /></Suspense>;
}

function AuthGateContent({ gate, children }: { gate: Gate; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { status } = useAuth();
  const business = useBusiness();
  const businessLoading = status === "authenticated" && business.isPending;
  let destination: string | null = null;

  if (status === "authenticated" && !businessLoading) {
    if (gate === "public-auth") destination = business.data ? safeDestination(searchParams.get("next")) ?? "/dashboard" : "/onboarding";
    else if (gate === "dashboard" && !business.data) destination = "/onboarding";
    else if (gate === "onboarding" && business.data) destination = "/dashboard";
  } else if (status === "unauthenticated" && gate !== "public-auth") {
    const query = searchParams.toString();
    const intended = `${pathname}${query ? `?${query}` : ""}`;
    destination = `/login?next=${encodeURIComponent(intended)}`;
  }

  useEffect(() => {
    if (destination) router.replace(destination);
  }, [destination, router]);

  // This remains a client-side demo UX guard, not a server authorization boundary.
  if (status === "loading" || businessLoading || destination) {
    return fallback;
  }
  return children;
}
