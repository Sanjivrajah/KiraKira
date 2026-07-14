import { AuthGate } from "@/components/auth/auth-gate";
import { AppShell } from "@/components/layout/app-shell";
import { TransactionList } from "@/components/transactions/transaction-list";

export default function TransactionsPage() {
  return <AuthGate gate="dashboard"><AppShell><TransactionList /></AppShell></AuthGate>;
}
