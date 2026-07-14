import { AuthGate } from "@/components/auth/auth-gate";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { AppShell } from "@/components/layout/app-shell";

export default function DashboardLoading() {
  return <AuthGate gate="dashboard"><AppShell><DashboardSkeleton /></AppShell></AuthGate>;
}
