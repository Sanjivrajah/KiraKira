"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { createQueryClient } from "@/lib/query/query-client";
import { AuthProvider } from "@/components/auth/auth-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return <QueryClientProvider client={queryClient}><AuthProvider>{children}</AuthProvider></QueryClientProvider>;
}
