import { AuthGate } from "@/components/auth/auth-gate";
import { InvoiceDetail } from "@/components/invoices/invoice-detail";
import { AppShell } from "@/components/layout/app-shell";

type InvoiceDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function InvoiceDetailPage({ params }: InvoiceDetailPageProps) {
  const { id } = await params;
  return <AuthGate gate="dashboard"><AppShell><InvoiceDetail id={id} /></AppShell></AuthGate>;
}
