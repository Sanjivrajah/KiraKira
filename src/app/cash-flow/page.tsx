import { connection } from "next/server";
import { AuthGate } from "@/components/auth/auth-gate";
import { CashFlowWorkspace } from "@/components/cash-flow/cash-flow-workspace";
import { AppShell } from "@/components/layout/app-shell";

export default async function CashFlowPage() {
  await connection();
  return <AuthGate gate="dashboard"><AppShell><CashFlowWorkspace now={new Date().toISOString()} /></AppShell></AuthGate>;
}
