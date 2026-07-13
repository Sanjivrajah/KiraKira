import { AuthGate } from "@/components/auth/auth-gate";
import { AppShell } from "@/components/layout/app-shell";
import { TransactionDetail } from "@/components/transactions/transaction-detail";

export default async function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AuthGate gate="dashboard"><AppShell><TransactionDetail id={id} /></AppShell></AuthGate>;
}
