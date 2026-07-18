"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { DEMO_BUSINESS } from "@/data/demo";
import { useBusiness } from "@/hooks/use-business";
import { useInvoice } from "@/hooks/use-invoices";
import { InvoiceBuilder } from "./invoice-builder";

export function InvoiceEditor({ id, now }: { id: string; now: string }) {
  const business = useBusiness().data;
  const { mode } = useAuth();
  const businessId = business?.id ?? (mode === "demo" ? DEMO_BUSINESS.id : "");
  const query = useInvoice(businessId, id);
  if (query.isPending) return <LoadingState label="Loading invoice editor" />;
  if (query.isError || !query.data) return <><Link className="back-link" href={`/invoices/${id}`}><ArrowLeft aria-hidden="true" size={17} />Back to invoice</Link><ErrorState title="Invoice could not be edited" description="The invoice could not be loaded. Return to the invoice and try again." /></>;
  if (query.data.status !== "draft") return <><Link className="back-link" href={`/invoices/${id}`}><ArrowLeft aria-hidden="true" size={17} />Back to invoice</Link><ErrorState title="Issued invoices are locked" description="Only draft source invoices can be edited. Create a new draft for a correction so the issued record and submission history remain intact." /></>;
  return <InvoiceBuilder initialInvoice={query.data} now={now} />;
}
