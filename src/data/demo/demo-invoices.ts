import type { Invoice } from "@/types";
import {
  DEMO_COMMERCIAL_DOCUMENTS,
  DEMO_DOCUMENT_CUSTOMER_SNAPSHOTS,
  DEMO_DOMAIN_PAYMENTS,
  DEMO_PAYMENT_ALLOCATIONS,
} from "./demo-commercial-documents";
import { toLegacyInvoice } from "./legacy-invoice-adapter";

/** Compatibility fixtures for the current UI; canonical values live in DEMO_COMMERCIAL_DOCUMENTS. */
export const DEMO_INVOICES: Invoice[] = DEMO_COMMERCIAL_DOCUMENTS.map((document) =>
  toLegacyInvoice({
    document,
    customer: DEMO_DOCUMENT_CUSTOMER_SNAPSHOTS[
      document.id as keyof typeof DEMO_DOCUMENT_CUSTOMER_SNAPSHOTS
    ],
    payments: DEMO_DOMAIN_PAYMENTS,
    allocations: DEMO_PAYMENT_ALLOCATIONS,
    asOfDate: "2026-07-14",
  }),
);
