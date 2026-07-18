import { AuthGate } from "@/components/auth/auth-gate";
import { AppShell } from "@/components/layout/app-shell";
import { connection } from "next/server";
import { NewInvoiceForm } from "./new-invoice-form";

export default async function NewInvoicePage() {
  await connection();
  return <AuthGate gate="dashboard"><AppShell><NewInvoiceForm now={new Date().toISOString()} /></AppShell></AuthGate>;
}
