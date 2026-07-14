"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getBrowserStorage } from "@/lib/storage/browser-storage";
import { STORAGE_KEYS } from "@/lib/storage/storage-keys";
import type { Business, BusinessInput, UserProfile, UserProfileInput } from "@/types";

export const STORE_VERSION = 2;
export const STORE_KEY = STORAGE_KEYS.session;

interface NiagaState {
  schemaVersion: number;
  user: UserProfile | null;
  isAuthenticated: boolean;
  business: Business | null;
  isOnboardingComplete: boolean;
  hasHydrated: boolean;
  signIn: (email: string, name?: string) => void;
  signUp: (user: UserProfileInput) => void;
  saveBusiness: (business: BusinessInput) => void;
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
        const now = new Date().toISOString();
        set({
          user:
            existing?.email === normalizedEmail
              ? existing
              : {
                  id: normalizedEmail === "lina@niagaai.demo" ? "demo-lina" : makeLocalUserId(normalizedEmail),
                  name: name?.trim() || displayNameFromEmail(normalizedEmail),
                  email: normalizedEmail,
                  createdAt: now,
                  updatedAt: now,
                },
          isAuthenticated: true,
        });
      },
      signUp: (user) => {
        const now = new Date().toISOString();
        set({ user: { ...user, createdAt: now, updatedAt: now }, isAuthenticated: true, business: null, isOnboardingComplete: false });
      },
      saveBusiness: (input) => {
        const existing = get().business;
        const now = new Date().toISOString();
        set({ business: {
          ...input,
          registrationNumber: input.registrationNumber || null,
          tin: input.tin || null,
          id: existing?.id || "business_demo",
          createdAt: existing?.createdAt || now,
          updatedAt: now,
        } });
      },
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
      migrate: (persistedState) => {
        if (!persistedState || typeof persistedState !== "object") return initialSession;
        const state = persistedState as Record<string, unknown>;
        const now = new Date().toISOString();
        const legacyUser = state.user && typeof state.user === "object" ? state.user as Record<string, unknown> : null;
        const legacyBusiness = state.business && typeof state.business === "object" ? state.business as Record<string, unknown> : null;
        return {
          ...state,
          schemaVersion: STORE_VERSION,
          user: legacyUser && typeof legacyUser.id === "string" && typeof legacyUser.name === "string" && typeof legacyUser.email === "string" ? {
            id: legacyUser.id, name: legacyUser.name, email: legacyUser.email,
            createdAt: typeof legacyUser.createdAt === "string" ? legacyUser.createdAt : now,
            updatedAt: typeof legacyUser.updatedAt === "string" ? legacyUser.updatedAt : now,
          } : null,
          business: legacyBusiness && typeof legacyBusiness.name === "string" && typeof legacyBusiness.type === "string" ? {
            ...legacyBusiness,
            id: typeof legacyBusiness.id === "string" ? legacyBusiness.id : "business_demo",
            registrationNumber: typeof legacyBusiness.registrationNumber === "string" && legacyBusiness.registrationNumber ? legacyBusiness.registrationNumber : null,
            tin: typeof legacyBusiness.tin === "string" && legacyBusiness.tin ? legacyBusiness.tin : null,
            createdAt: typeof legacyBusiness.createdAt === "string" ? legacyBusiness.createdAt : now,
            updatedAt: typeof legacyBusiness.updatedAt === "string" ? legacyBusiness.updatedAt : now,
          } : null,
        };
      },
      storage: createJSONStorage(() => getBrowserStorage() as Storage),
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
