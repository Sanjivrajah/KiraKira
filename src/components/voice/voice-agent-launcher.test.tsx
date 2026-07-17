import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VOICE_PHASE_COPY } from "./use-voice-agent";

const mocks = vi.hoisted(() => ({ agent: vi.fn(), pathname: vi.fn() }));

vi.mock("next/navigation", () => ({ usePathname: mocks.pathname }));
vi.mock("./voice-agent-provider", () => ({ usePersistentVoiceAgent: mocks.agent }));
vi.mock("@/components/auth/auth-provider", () => ({ useAuth: () => ({ status: "authenticated" }) }));
vi.mock("@/hooks/use-business", () => ({ useBusiness: () => ({ data: { id: "business-1" }, isLoading: false }) }));

import { VoiceAgentLauncher } from "./voice-agent-launcher";

function readyAgent() {
  return {
    status: "disconnected" as const,
    phase: "idle" as const,
    stateLabel: VOICE_PHASE_COPY.idle.label,
    stateHint: VOICE_PHASE_COPY.idle.hint,
    connecting: false,
    canConnect: true,
    isSpeaking: false,
    isListening: false,
    isMuted: false,
    error: null,
    transcript: [], transcriptStorage: "disabled" as const, historyRefreshKey: 0,
    getInputVolume: () => 0, getOutputVolume: () => 0,
    connect: vi.fn().mockResolvedValue(undefined), disconnect: vi.fn(), toggleMute: vi.fn(),
  };
}

describe("VoiceAgentLauncher", () => {
  beforeEach(() => {
    mocks.pathname.mockReturnValue("/dashboard");
    mocks.agent.mockReturnValue(readyAgent());
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("keeps a compact orb available away from the expanded voice page", () => {
    const agent = readyAgent();
    mocks.agent.mockReturnValue(agent);
    render(<VoiceAgentLauncher />);

    fireEvent.click(screen.getByRole("button", { name: /Open voice assistant/i }));
    expect(screen.getByText("NiagaAI assistant")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start talking" }));
    expect(agent.connect).toHaveBeenCalledTimes(1);
  });

  it("does not duplicate the launcher on the expanded voice page", () => {
    mocks.pathname.mockReturnValue("/voice");
    render(<VoiceAgentLauncher />);
    expect(screen.queryByRole("button", { name: /voice assistant/i })).not.toBeInTheDocument();
  });
});
