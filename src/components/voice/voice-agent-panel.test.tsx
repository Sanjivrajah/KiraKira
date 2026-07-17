import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VOICE_PHASE_COPY, type VoicePhase } from "./use-voice-agent";

const mocks = vi.hoisted(() => ({
  usePersistentVoiceAgent: vi.fn(),
  history: vi.fn(),
}));

vi.mock("@elevenlabs/react", () => ({
  ConversationProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/hooks/use-business", () => ({
  useBusiness: () => ({ data: { id: "business-1", name: "Kedai Murni" }, isLoading: false }),
}));
vi.mock("./voice-agent-provider", () => ({ usePersistentVoiceAgent: mocks.usePersistentVoiceAgent }));
vi.mock("./voice-draft-review", () => ({ VoiceDraftReview: () => <div>Review queue</div> }));
vi.mock("./voice-conversation-history", () => ({
  VoiceConversationHistory: (props: unknown) => mocks.history(props),
}));

import { VoiceAgentPanel } from "./voice-agent-panel";

function agentFor(phase: VoicePhase) {
  const connected = ["listening", "thinking", "speaking", "muted"].includes(phase);
  return {
    status: phase === "connecting" ? "connecting" : phase === "error" ? "error" : connected ? "connected" : "disconnected",
    phase,
    stateLabel: VOICE_PHASE_COPY[phase].label,
    stateHint: VOICE_PHASE_COPY[phase].hint,
    connecting: phase === "connecting",
    canConnect: phase === "idle" || phase === "error",
    isSpeaking: phase === "speaking",
    isListening: phase === "listening",
    isMuted: phase === "muted",
    error: phase === "error" ? "The microphone could not connect." : null,
    transcript: [],
    transcriptStorage: "idle",
    historyRefreshKey: 0,
    getInputVolume: () => 0,
    getOutputVolume: () => 0,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    toggleMute: vi.fn(),
  };
}

describe("VoiceAgentPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
    mocks.usePersistentVoiceAgent.mockReturnValue(agentFor("idle"));
    mocks.history.mockReturnValue(<div>Loaded conversation history</div>);
  });

  afterEach(() => vi.unstubAllGlobals());

  it.each<VoicePhase>(["idle", "connecting", "listening", "thinking", "speaking", "muted", "error"])("renders the %s phase", (phase) => {
    mocks.usePersistentVoiceAgent.mockReturnValue(agentFor(phase));
    render(<VoiceAgentPanel />);

    expect(screen.getByRole("status")).toHaveTextContent(VOICE_PHASE_COPY[phase].label);
    expect(screen.getByText(VOICE_PHASE_COPY[phase].hint)).toBeInTheDocument();
  });

  it("shows prompts only while idle and loads history only after expansion", () => {
    render(<VoiceAgentPanel />);

    expect(screen.getByText("Try saying")).toBeInTheDocument();
    expect(mocks.history).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Conversation history/i }));

    expect(screen.getByText("Loaded conversation history")).toBeInTheDocument();
    expect(mocks.history).toHaveBeenCalledTimes(1);
  });

  it("exposes clear active-call controls", () => {
    const agent = agentFor("listening");
    mocks.usePersistentVoiceAgent.mockReturnValue(agent);
    render(<VoiceAgentPanel />);

    fireEvent.click(screen.getByRole("button", { name: "Mute" }));
    fireEvent.click(screen.getByRole("button", { name: "End call" }));

    expect(agent.toggleMute).toHaveBeenCalledTimes(1);
    expect(agent.disconnect).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Try saying")).not.toBeInTheDocument();
  });
});
