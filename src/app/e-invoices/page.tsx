import { AuthGate } from "@/components/auth/auth-gate";
import { EInvoiceWorkspace } from "@/components/e-invoices/e-invoice-workspace";
import { AppShell } from "@/components/layout/app-shell";

export default function EInvoicesPage() {
  return <AuthGate gate="dashboard"><AppShell><EInvoiceWorkspace /></AppShell></AuthGate>;
}

