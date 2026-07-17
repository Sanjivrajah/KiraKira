import { LoanReadinessWorkspace } from "@/components/loan-readiness/loan-readiness-workspace";
import { AuthGate } from "@/components/auth/auth-gate";
import { AppShell } from "@/components/layout/app-shell";

export default function LoanReadinessPage() {
  return <AuthGate gate="dashboard"><AppShell><LoanReadinessWorkspace /></AppShell></AuthGate>;
}
