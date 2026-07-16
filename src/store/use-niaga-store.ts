"use client";

import { create } from "zustand";

interface NiagaUiState {
  onboardingStep: 1 | 2 | 3 | 4 | 5;
  setOnboardingStep: (step: 1 | 2 | 3 | 4 | 5) => void;
  resetTemporaryUi: () => void;
}

export const initialUiState = { onboardingStep: 1 as const };

export const useNiagaStore = create<NiagaUiState>()((set) => ({
  ...initialUiState,
  setOnboardingStep: (onboardingStep) => set({ onboardingStep }),
  resetTemporaryUi: () => set(initialUiState),
}));
