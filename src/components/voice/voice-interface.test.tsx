import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceCaptions } from "./voice-captions";
import { VoiceOrb } from "./voice-orb";
import { VOICE_PHASE_COPY, type VoicePhase } from "./use-voice-agent";

const phases: VoicePhase[] = ["idle", "connecting", "listening", "thinking", "speaking", "muted", "error"];

describe("voice interface states", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      matches: false,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
  });

  afterEach(() => vi.unstubAllGlobals());

  it.each(phases)("gives the %s phase distinct visible guidance", (phase) => {
    expect(VOICE_PHASE_COPY[phase].label).not.toHaveLength(0);
    expect(VOICE_PHASE_COPY[phase].hint).not.toHaveLength(0);

    const { container } = render(<VoiceOrb phase={phase} getInputVolume={() => 0.2} getOutputVolume={() => 0.3} />);
    expect(container.querySelector(".voice-orb")).toHaveAttribute("data-phase", phase);
  });
});

describe("VoiceCaptions", () => {
  it("keeps new-turn scrolling inside the transcript log", () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView });

    const { rerender } = render(<VoiceCaptions transcript={[{ id: 1, role: "user", text: "First turn" }]} />);
    const log = screen.getByRole("log");
    Object.defineProperty(log, "scrollHeight", { configurable: true, value: 240 });
    log.scrollTop = 0;

    rerender(<VoiceCaptions transcript={[
      { id: 1, role: "user", text: "First turn" },
      { id: 2, role: "assistant", text: "Second turn" },
    ]} />);

    expect(log.scrollTop).toBe(240);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
