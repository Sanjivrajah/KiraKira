"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LoadingState } from "@/components/shared/loading-state";
import { useNiagaStore } from "@/store/use-niaga-store";

type Gate = "public-auth" | "onboarding" | "dashboard";

export function AuthGate({ gate, children }: { gate: Gate; children: ReactNode }) {
  const router = useRouter();
  const hasHydrated = useNiagaStore((state) => state.hasHydrated);
  const setHasHydrated = useNiagaStore((state) => state.setHasHydrated);
  const isAuthenticated = useNiagaStore((state) => state.isAuthenticated);
  const isOnboardingComplete = useNiagaStore((state) => state.isOnboardingComplete);
  let destination: string | null = null;
  if (hasHydrated) {
    if (gate === "public-auth" && isAuthenticated) {
      destination = isOnboardingComplete ? "/dashboard" : "/onboarding";
    } else if (gate !== "public-auth" && !isAuthenticated) {
      destination = "/login";
    } else if (gate === "dashboard" && !isOnboardingComplete) {
      destination = "/onboarding";
    } else if (gate === "onboarding" && isOnboardingComplete) {
      destination = "/dashboard";
    }
  }

  useEffect(() => {
    if (destination) router.replace(destination);
  }, [destination, router]);

  useEffect(() => {
    if (hasHydrated) return;
    void useNiagaStore.persist.rehydrate();
    setHasHydrated(true);
  }, [hasHydrated, setHasHydrated]);

  // This is a client-side demo UX guard, not an authentication security boundary.
  if (!hasHydrated || destination) {
    return <main className="route-loading"><LoadingState label="Restoring your demo session" /></main>;
  }

  return children;
}
