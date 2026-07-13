import { AuthGate } from "@/components/auth/auth-gate";
import { InvoiceList } from "@/components/invoices/invoice-list";
import { AppShell } from "@/components/layout/app-shell";

export default async function InvoicesPage({ searchParams }: PageProps<"/invoices">) {
  const query = await searchParams;
  const initialMessage = query.created === "1"
    ? "Invoice saved to this browser."
    : query.deleted === "1"
      ? "Invoice deleted successfully."
      : "";
  return <AuthGate gate="dashboard"><AppShell><InvoiceList initialMessage={initialMessage} /></AppShell></AuthGate>;
}
