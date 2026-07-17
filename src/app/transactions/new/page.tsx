import { AuthGate } from "@/components/auth/auth-gate";
import { AppShell } from "@/components/layout/app-shell";
import { NewTransactionForm } from "./new-transaction-form";
import type { TransactionSourceType } from "@/types";

const sources = new Set<TransactionSourceType>(["receipt", "voice", "manual", "csv", "bank_statement", "whatsapp"]);

type NewTransactionPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewTransactionPage({ searchParams }: NewTransactionPageProps) {
  const query = await searchParams;
  const requestedMethod = typeof query.method === "string" && sources.has(query.method as TransactionSourceType)
    ? query.method as TransactionSourceType
    : undefined;
  const demoScenario = requestedMethod === "receipt" && query.demo === "ambiguous"
    ? "ambiguous-receipt" as const
    : undefined;
  const reviewTransactionId = typeof query.reviewId === "string"
    ? query.reviewId
    : demoScenario
      ? "txn_002"
      : undefined;

  return (
    <AuthGate gate="dashboard">
      <AppShell>
        <NewTransactionForm demoScenario={demoScenario} initialMethod={requestedMethod} reviewTransactionId={reviewTransactionId} />
      </AppShell>
    </AuthGate>
  );
}
