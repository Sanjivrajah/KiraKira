import { AuthGate } from "@/components/auth/auth-gate";
import { InvoiceBuilder } from "@/components/invoices/invoice-builder";
import { AppShell } from "@/components/layout/app-shell";

export default function NewInvoicePage() {
  return <AuthGate gate="dashboard"><AppShell><InvoiceBuilder /></AppShell></AuthGate>;
}
