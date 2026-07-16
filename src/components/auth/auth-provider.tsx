"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { clearQueryCache } from "@/lib/query/query-client";
import { services } from "@/services";
import { authMode, authService, type AuthMode } from "@/services/auth";
import { useNiagaStore } from "@/store/use-niaga-store";
import type { AuthService, AuthSession, SignInInput, SignUpInput } from "@/types";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  mode: AuthMode;
  session: AuthSession | null;
  activeBusinessId: string | null;
  setActiveBusinessId(businessId: string | null): void;
  signIn(input: SignInInput): Promise<void>;
  signUp(input: SignUpInput): Promise<void>;
  signOut(): Promise<void>;
  resetDemo(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

type ResettableAuthService = AuthService & { reset?: () => Promise<void> };

export function AuthProvider({ children, service = authService, mode = authMode }: { children: ReactNode; service?: ResettableAuthService; mode?: AuthMode }) {
  const queryClient = useQueryClient();
  const resetTemporaryUi = useNiagaStore((state) => state.resetTemporaryUi);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    let active = true;
    const unsubscribe = service.subscribe((nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setActiveBusinessId(null);
      setStatus(nextSession ? "authenticated" : "unauthenticated");
    });
    void service.getSession().then((nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setActiveBusinessId(null);
      setStatus(nextSession ? "authenticated" : "unauthenticated");
    });
    return () => { active = false; unsubscribe(); };
  }, [service]);

  const signIn = useCallback(async (input: SignInInput) => { await service.signIn(input); }, [service]);
  const signUp = useCallback(async (input: SignUpInput) => { await service.signUp(input); }, [service]);
  const signOut = useCallback(async () => {
    clearQueryCache(queryClient);
    resetTemporaryUi();
    await service.signOut();
  }, [queryClient, resetTemporaryUi, service]);
  const resetDemo = useCallback(async () => {
    await services.demo.reset();
    clearQueryCache(queryClient);
    resetTemporaryUi();
    if (service.reset) await service.reset();
    else await service.signOut();
  }, [queryClient, resetTemporaryUi, service]);

  const value = useMemo(() => ({ status, mode, session, activeBusinessId, setActiveBusinessId, signIn, signUp, signOut, resetDemo }), [activeBusinessId, mode, resetDemo, session, signIn, signOut, signUp, status]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider.");
  return value;
}
