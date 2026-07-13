"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { DemoUser } from "@/types/auth";
import type { BusinessProfile } from "@/types/business";

export const STORE_VERSION = 1;
export const STORE_KEY = "niagaai-demo-session";

interface NiagaState {
  schemaVersion: number;
  user: DemoUser | null;
  isAuthenticated: boolean;
  business: BusinessProfile | null;
  isOnboardingComplete: boolean;
  hasHydrated: boolean;
  signIn: (email: string, name?: string) => void;
  signUp: (user: DemoUser) => void;
  saveBusiness: (business: BusinessProfile) => void;
  completeOnboarding: () => void;
  signOut: () => void;
  resetDemo: () => void;
  setHasHydrated: (value: boolean) => void;
}

export const initialSession = {
  schemaVersion: STORE_VERSION,
  user: null,
  isAuthenticated: false,
  business: null,
  isOnboardingComplete: false,
} satisfies Pick<
  NiagaState,
  "schemaVersion" | "user" | "isAuthenticated" | "business" | "isOnboardingComplete"
>;

const displayNameFromEmail = (email: string) => {
  const localPart = email.split("@")[0] || "Demo user";
  return localPart
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export const makeLocalUserId = (email: string) => {
  let hash = 0;
  for (const character of email.toLowerCase()) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return `local-${hash.toString(36)}`;
};

export const useNiagaStore = create<NiagaState>()(
  persist(
    (set, get) => ({
      ...initialSession,
      hasHydrated: false,
      signIn: (email, name) => {
        const normalizedEmail = email.trim().toLowerCase();
        const existing = get().user;
        set({
          user:
            existing?.email === normalizedEmail
              ? existing
              : {
                  id: normalizedEmail === "lina@niagaai.demo" ? "demo-lina" : makeLocalUserId(normalizedEmail),
                  name: name?.trim() || displayNameFromEmail(normalizedEmail),
                  email: normalizedEmail,
                },
          isAuthenticated: true,
        });
      },
      signUp: (user) => set({ user, isAuthenticated: true, business: null, isOnboardingComplete: false }),
      saveBusiness: (business) => set({ business }),
      completeOnboarding: () => {
        if (get().business) set({ isOnboardingComplete: true });
      },
      signOut: () => set({ user: null, isAuthenticated: false }),
      resetDemo: () => set({ ...initialSession }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: STORE_KEY,
      version: STORE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        schemaVersion: state.schemaVersion,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        business: state.business,
        isOnboardingComplete: state.isOnboardingComplete,
      }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
);
