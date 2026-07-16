import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { services } from "@/services";
import { createQueryWrapper } from "@/test/render";

const auth = vi.hoisted(() => ({ mode: "demo" as "demo" | "supabase" }));
vi.mock("@/components/auth/auth-provider", () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => ({ mode: auth.mode }),
}));

import { useDashboardSummary } from "./use-dashboard-summary";

describe("useDashboardSummary", () => {
  afterEach(() => vi.restoreAllMocks());

  it("does not initialize browser demo data in Supabase mode", async () => {
    auth.mode = "supabase";
    const transactions = vi.spyOn(services.transactions, "initializeDemo");
    const invoices = vi.spyOn(services.invoices, "initializeDemo");
    vi.spyOn(services.dashboard, "getSummary").mockResolvedValue({
      transactions: [], invoices: [], metrics: { revenue: 0, expenses: 0, profit: 0, profitMargin: null, outstandingPayments: 0, overdueInvoiceCount: 0 }, cashFlow: [], reviewCount: 0, outstandingInvoices: [],
    });

    const result = renderHook(() => useDashboardSummary("business-id", new Date("2026-07-16T00:00:00.000Z")), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(result.result.current.isSuccess).toBe(true));
    expect(transactions).not.toHaveBeenCalled();
    expect(invoices).not.toHaveBeenCalled();
  });
});
