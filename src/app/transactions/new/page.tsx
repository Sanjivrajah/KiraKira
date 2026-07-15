import { AuthGate } from "@/components/auth/auth-gate";
import { AppShell } from "@/components/layout/app-shell";
import { TransactionCaptureFlow } from "@/components/transactions/transaction-capture-flow";
import type { TransactionSourceType } from "@/types";

const sources = new Set<TransactionSourceType>(["receipt", "voice", "manual", "csv", "bank_statement", "whatsapp"]);

export default async function NewTransactionPage({ searchParams }: PageProps<"/transactions/new">) {
  const query = await searchParams;
  const requestedMethod = typeof query.method === "string" && sources.has(query.method as TransactionSourceType)
    ? query.method as TransactionSourceType
    : undefined;
  const demoScenario = requestedMethod === "receipt" && query.demo === "ambiguous"
    ? "ambiguous-receipt" as const
    : undefined;

  return (
    <AuthGate gate="dashboard">
      <AppShell>
        <TransactionCaptureFlow demoScenario={demoScenario} initialMethod={requestedMethod} />
      </AppShell>
    </AuthGate>
  );
}
