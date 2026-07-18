import { describe, expect, it, vi } from "vitest";
import type { Invoice } from "@/types";

const mocks = vi.hoisted(() => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc(this: unknown, name: string, args: Record<string, unknown>) {
      if (this !== client) throw new Error("Supabase RPC lost its client context");
      calls.push({ name, args });
      return Promise.resolve({
        data: { id: "43066f9c-f29d-46ca-8c7a-928fc0a065a2", total_minor: 10007 },
        error: null,
      });
    },
  };
  return { calls, client };
});

vi.mock("@/lib/supabase/browser-client", () => ({
  getSupabaseBrowserClient: () => mocks.client,
}));

import { SupabaseInvoiceLifecycleRepository } from "./invoice-lifecycle-repository";

const invoice: Invoice = {
  id: "43066f9c-f29d-46ca-8c7a-928fc0a065a2",
  businessId: "0ac4bd7c-b211-4ed9-a877-4c23fe27ec07",
  invoiceNumber: "DRAFT-715e3afb-4e6b-434e-9180-6ef2199a9651",
  customerId: "715e3afb-4e6b-434e-9180-6ef2199a9651",
  customerName: "Buyer Sdn. Bhd.",
  issueDate: "2026-07-17",
  dueDate: "2026-07-31",
  status: "draft",
  currency: "MYR",
  items: [{
    id: "line-1",
    description: "Catering",
    quantity: 1,
    unitPrice: 100.07,
    taxRate: 0,
    classificationCode: "022",
    unitCode: "C62",
    taxTypeCode: "06",
  }],
  subtotal: 100.07,
  tax: 0,
  total: 100.07,
  amountPaid: 0,
  prepaymentAmount: 10.05,
  createdAt: "2026-07-17T10:00:00.000Z",
  updatedAt: "2026-07-17T10:00:00.000Z",
};

describe("SupabaseInvoiceLifecycleRepository", () => {
  it("preserves the Supabase client context when saving edited draft metadata", async () => {
    mocks.calls.length = 0;

    await expect(new SupabaseInvoiceLifecycleRepository().saveDraft(invoice))
      .resolves.toEqual(expect.objectContaining({ id: invoice.id, total_minor: 10007 }));

    expect(mocks.calls).toEqual([
      expect.objectContaining({
        name: "save_invoice_draft_with_metadata",
        args: expect.objectContaining({
          p_invoice_id: invoice.id,
          p_metadata: expect.objectContaining({ invoiceNumber: invoice.invoiceNumber }),
        }),
      }),
    ]);
  });
});
