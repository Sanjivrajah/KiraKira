"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useEffect } from "react";
import { createQueryClient } from "@/lib/query/query-client";
import { AuthProvider } from "@/components/auth/auth-provider";
import { ThemeProvider } from "@/components/settings/theme-provider";
import { runFrontendStorageMigration } from "@/frontend/storage";

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  useEffect(() => {
    runFrontendStorageMigration();
  }, []);
  return <QueryClientProvider client={queryClient}><AuthProvider><ThemeProvider>{children}</ThemeProvider></AuthProvider></QueryClientProvider>;
}
