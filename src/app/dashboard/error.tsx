"use client";

import { useEffect } from "react";
import { AuthGate } from "@/components/auth/auth-gate";
import { AppShell } from "@/components/layout/app-shell";
import { ErrorState } from "@/components/shared/error-state";

export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <AuthGate gate="dashboard">
      <AppShell>
        <ErrorState title="Dashboard unavailable" description="We could not prepare your financial overview. Your saved information has not been changed." />
        <button className="button button-primary dashboard-retry" onClick={unstable_retry} type="button">Try again</button>
      </AppShell>
    </AuthGate>
  );
}
