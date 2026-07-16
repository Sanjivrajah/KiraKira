import { QueryClientProvider } from "@tanstack/react-query";
import { render as testingLibraryRender, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { createQueryClient } from "@/lib/query/query-client";
import { AuthProvider } from "@/components/auth/auth-provider";

export function render(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  const queryClient = createQueryClient();
  const Wrapper = createQueryWrapper(queryClient);
  return { queryClient, ...testingLibraryRender(ui, { wrapper: Wrapper, ...options }) };
}

export function createQueryWrapper(queryClient = createQueryClient()) {
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}><AuthProvider>{children}</AuthProvider></QueryClientProvider>;
  };
}
