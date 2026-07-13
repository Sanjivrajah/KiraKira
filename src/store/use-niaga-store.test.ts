import { beforeEach, describe, expect, it } from "vitest";
import { STORE_KEY, initialSession, useNiagaStore } from "./use-niaga-store";

describe("Niaga store", () => {
  beforeEach(() => {
    useNiagaStore.setState({ ...initialSession, hasHydrated: true });
  });

  it("completes onboarding only after a business is saved", () => {
    useNiagaStore.getState().completeOnboarding();
    expect(useNiagaStore.getState().isOnboardingComplete).toBe(false);
    useNiagaStore.getState().saveBusiness({
      name: "Warung Kak Lina",
      type: "food_beverage",
      registrationNumber: "",
      tin: "",
      currency: "MYR",
      preferredLanguage: "ms",
    });
    useNiagaStore.getState().completeOnboarding();
    expect(useNiagaStore.getState().isOnboardingComplete).toBe(true);
  });

  it("signs out without deleting the local business", () => {
    useNiagaStore.getState().signIn("lina@niagaai.demo");
    useNiagaStore.getState().saveBusiness({
      name: "Warung Kak Lina",
      type: "food_beverage",
      registrationNumber: "",
      tin: "",
      currency: "MYR",
      preferredLanguage: "en",
    });
    useNiagaStore.getState().signOut();
    expect(useNiagaStore.getState()).toMatchObject({ isAuthenticated: false, user: null });
    expect(useNiagaStore.getState().business?.name).toBe("Warung Kak Lina");
  });

  it("resets all persisted demo data and never serializes passwords", () => {
    useNiagaStore.getState().signUp({ id: "local-1", name: "Lina", email: "lina@example.com" });
    useNiagaStore.getState().resetDemo();
    expect(useNiagaStore.getState()).toMatchObject(initialSession);
    const persisted = localStorage.getItem(STORE_KEY) ?? "";
    expect(persisted).not.toContain("password");
  });
});
