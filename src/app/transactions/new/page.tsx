import { AuthGate } from "@/components/auth/auth-gate";
import { AppShell } from "@/components/layout/app-shell";
import { TransactionCaptureFlow } from "@/components/transactions/transaction-capture-flow";
import type { TransactionSource } from "@/types/finance";

const sources = new Set<TransactionSource>(["receipt", "voice", "manual", "csv", "bank_statement", "whatsapp"]);

export default async function NewTransactionPage({ searchParams }: PageProps<"/transactions/new">) {
  const query = await searchParams;
  const requestedMethod = typeof query.method === "string" && sources.has(query.method as TransactionSource)
    ? query.method as TransactionSource
    : undefined;

  return (
    <AuthGate gate="dashboard">
      <AppShell>
        <TransactionCaptureFlow initialMethod={requestedMethod} />
      </AppShell>
    </AuthGate>
  );
}
