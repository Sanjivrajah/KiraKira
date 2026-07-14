import { AuthGate } from "@/components/auth/auth-gate";
import { InvoiceBuilder } from "@/components/invoices/invoice-builder";
import { AppShell } from "@/components/layout/app-shell";
import { connection } from "next/server";

export default async function NewInvoicePage() {
  await connection();
  return <AuthGate gate="dashboard"><AppShell><InvoiceBuilder now={new Date().toISOString()} /></AppShell></AuthGate>;
}
