import { AuthGate } from "@/components/auth/auth-gate";
import { InvoiceDetail } from "@/components/invoices/invoice-detail";
import { AppShell } from "@/components/layout/app-shell";

export default async function InvoiceDetailPage({ params }: PageProps<"/invoices/[id]">) {
  const { id } = await params;
  return <AuthGate gate="dashboard"><AppShell><InvoiceDetail id={id} /></AppShell></AuthGate>;
}
