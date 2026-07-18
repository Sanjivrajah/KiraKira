import { AuthGate } from "@/components/auth/auth-gate";
import { InvoiceEditor } from "@/components/invoices/invoice-editor";
import { AppShell } from "@/components/layout/app-shell";

export default async function InvoiceEditPage({ params }: PageProps<"/invoices/[id]/edit">) {
  const { id } = await params;
  return <AuthGate gate="dashboard"><AppShell><InvoiceEditor id={id} now={new Date().toISOString()} /></AppShell></AuthGate>;
}
