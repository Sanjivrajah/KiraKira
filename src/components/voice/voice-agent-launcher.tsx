"use client";

import { Mic, MicOff, PhoneOff, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { VoiceOrb } from "./voice-orb";
import { usePersistentVoiceAgent } from "./voice-agent-provider";
import { useAuth } from "@/components/auth/auth-provider";
import { useBusiness } from "@/hooks/use-business";

export function VoiceAgentLauncher() {
  const pathname = usePathname();
  const agent = usePersistentVoiceAgent();
  const { status } = useAuth();
  const { data: business, isLoading: businessLoading } = useBusiness();
  const [open, setOpen] = useState(false);
  const launcherRef = useRef<HTMLDivElement>(null);
  const active = agent.status === "connected" || agent.connecting || agent.status === "connecting";

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    const closeOnOutside = (event: PointerEvent) => {
      if (!launcherRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnOutside);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnOutside);
    };
  }, [open]);

  if (pathname === "/voice" || status !== "authenticated" || businessLoading || !business) return null;

  return (
    <div className="voice-agent-launcher" ref={launcherRef}>
      {open ? (
        <section className="voice-agent-popover" id="voice-agent-controls" aria-label="Voice assistant controls">
          <div className="voice-agent-popover-heading">
            <span>{active ? "Live assistant" : "NiagaAI assistant"}</span>
            <button aria-label="Close voice assistant controls" className="voice-agent-popover-close" onClick={() => setOpen(false)} type="button"><X aria-hidden="true" size={18} /></button>
          </div>
          <p aria-live="polite">{agent.stateLabel}</p>
          <small>{agent.stateHint}</small>
          {agent.error ? <p className="voice-agent-popover-error" role="alert">{agent.error}</p> : null}
          {agent.status === "connected" ? (
            <div className="voice-agent-popover-actions">
              <button className="button button-secondary" onClick={agent.toggleMute} type="button">{agent.isMuted ? <Mic aria-hidden="true" size={17} /> : <MicOff aria-hidden="true" size={17} />}{agent.isMuted ? "Unmute" : "Mute"}</button>
              <button className="button button-secondary voice-agent-end-button" onClick={agent.disconnect} type="button"><PhoneOff aria-hidden="true" size={17} />End call</button>
            </div>
          ) : (
            <button className="button button-primary voice-agent-popover-start" disabled={!agent.canConnect || agent.connecting} onClick={() => void agent.connect()} type="button"><Mic aria-hidden="true" size={17} />{agent.connecting ? "Connecting…" : "Start talking"}</button>
          )}
        </section>
      ) : null}
      <button aria-controls="voice-agent-controls" aria-expanded={open} aria-label={`${active ? "Live" : "Open"} voice assistant. ${agent.stateLabel}.`} className="voice-agent-fab" data-active={active || undefined} onClick={() => setOpen((value) => !value)} type="button">
        <VoiceOrb compact getInputVolume={agent.getInputVolume} getOutputVolume={agent.getOutputVolume} phase={agent.phase} />
        <span className="voice-agent-fab-label">{active ? "Live" : "Ask NiagaAI"}</span>
      </button>
    </div>
  );
}
