import { beforeEach, describe, expect, it } from "vitest";
import { initialUiState, useNiagaStore } from "./use-niaga-store";

describe("Niaga UI store", () => {
  beforeEach(() => useNiagaStore.setState(initialUiState));

  it("contains only temporary onboarding UI state", () => {
    useNiagaStore.getState().setOnboardingStep(3);
    expect(useNiagaStore.getState().onboardingStep).toBe(3);
    useNiagaStore.getState().resetTemporaryUi();
    expect(useNiagaStore.getState().onboardingStep).toBe(1);
    expect(useNiagaStore.getState()).not.toHaveProperty("user");
    expect(useNiagaStore.getState()).not.toHaveProperty("business");
    expect(useNiagaStore.getState()).not.toHaveProperty("isAuthenticated");
  });
});
