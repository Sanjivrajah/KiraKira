import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProviders } from "@/app/providers";
import { DEMO_TRANSACTIONS } from "@/data/demo";
import { useCreateTransaction, useDeleteTransaction, useTransactions, useUpdateTransaction } from "@/hooks/use-transactions";
import { clearQueryCache, createQueryClient } from "@/lib/query/query-client";
import { queryKeys } from "@/lib/query/query-keys";
import { services } from "@/services";
import { createQueryWrapper } from "@/test/render";

const fixture = DEMO_TRANSACTIONS[0];
const createInput = fixture;

describe("TanStack Query integration", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("keeps one query client while the app provider rerenders", () => {
    const clients: QueryClient[] = [];
    function Probe() {
      clients.push(useQueryClient());
      return <span>Provider ready</span>;
    }
    const view = render(<AppProviders><Probe /></AppProviders>);
    view.rerender(<AppProviders><Probe /></AppProviders>);
    expect(screen.getByText("Provider ready")).toBeInTheDocument();
    expect(clients[0]).toBe(clients.at(-1));
  });

  it("loads a successful collection and preserves an empty collection", async () => {
    const client = createQueryClient();
    const successful = renderHook(() => useTransactions("business_demo"), { wrapper: createQueryWrapper(client) });
    await waitFor(() => expect(successful.result.current.isSuccess).toBe(true));
    expect(successful.result.current.data?.length).toBeGreaterThan(0);
    successful.unmount();

    vi.spyOn(services.transactions, "initializeDemo").mockResolvedValueOnce([]);
    const empty = renderHook(() => useTransactions("empty_business"), { wrapper: createQueryWrapper(createQueryClient()) });
    await waitFor(() => expect(empty.result.current.isSuccess).toBe(true));
    expect(empty.result.current.data).toEqual([]);
  });

  it("exposes repository failures so the UI can retry", async () => {
    vi.spyOn(services.transactions, "initializeDemo").mockRejectedValue(new Error("read failed"));
    const query = renderHook(() => useTransactions("business_demo"), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(query.result.current.isError).toBe(true));
    expect(query.result.current.error).toBeInstanceOf(Error);
  });

  it("invalidates precise dependents after create, update, and delete", async () => {
    const client = createQueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const hooks = renderHook(() => ({
      create: useCreateTransaction(),
      update: useUpdateTransaction(),
      remove: useDeleteTransaction(),
    }), { wrapper: createQueryWrapper(client) });

    let created = fixture;
    await act(async () => {
      created = await hooks.result.current.create.mutateAsync(createInput);
    });
    await act(async () => {
      await hooks.result.current.update.mutateAsync({ ...created, description: "Updated transaction" });
    });
    client.setQueryData(queryKeys.transactions.detail(created.businessId, created.id), created);
    await act(async () => {
      await hooks.result.current.remove.mutateAsync({ businessId: created.businessId, transactionId: created.id });
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.transactions.list(created.businessId) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.dashboard(created.businessId) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.loanReadiness(created.businessId) });
    expect(client.getQueryData(queryKeys.transactions.detail(created.businessId, created.id))).toBeUndefined();
  });

  it("surfaces mutation failures without writing success data", async () => {
    vi.spyOn(services.transactions, "create").mockRejectedValueOnce(new Error("write failed"));
    const mutation = renderHook(() => useCreateTransaction(), { wrapper: createQueryWrapper() });
    await act(async () => {
      await expect(mutation.result.current.mutateAsync(createInput)).rejects.toThrow("write failed");
    });
    await waitFor(() => expect(mutation.result.current.isError).toBe(true));
  });

  it("clears all cached domain data for sign-out and demo reset", () => {
    const client = createQueryClient();
    client.setQueryData(queryKeys.transactions.list("business_demo"), fixture);
    client.setQueryData(queryKeys.dashboard("business_demo"), { reviewCount: 1 });
    clearQueryCache(client);
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });
});
