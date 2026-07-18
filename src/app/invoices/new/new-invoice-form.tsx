"use client";

import { useEffect, useState } from "react";
import { InvoiceBuilder } from "@/components/invoices/invoice-builder";
import { useVoiceDraftStore } from "@/components/voice/voice-draft-store";
import { voiceInvoiceToPrefill } from "@/components/voice/voice-draft-to-form";

/**
 * Client boundary for the "new invoice" route. Reads any invoice the voice
 * agent staged, hands it to the real builder as prefill, then clears the draft
 * so a later visit starts blank.
 */
export function NewInvoiceForm({ now }: { now: string }) {
  const invoiceDraft = useVoiceDraftStore((state) => state.invoice);
  const clearInvoice = useVoiceDraftStore((state) => state.clearInvoice);
  // Snapshot once on mount so the form doesn't reset if the store changes later.
  const [prefill] = useState(() => (invoiceDraft ? voiceInvoiceToPrefill(invoiceDraft) : undefined));

  useEffect(() => {
    if (prefill) clearInvoice();
  }, [prefill, clearInvoice]);

  return <InvoiceBuilder now={now} prefill={prefill} />;
}
