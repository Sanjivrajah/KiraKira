"use client";

import { AudioLines, Mic, MicOff, PhoneOff } from "lucide-react";
import { ConversationProvider } from "@elevenlabs/react";
import { PageHeader } from "@/components/shared/page-header";
import { useBusiness } from "@/hooks/use-business";
import { useVoiceAgent } from "./use-voice-agent";
import { VoiceDraftReview } from "./voice-draft-review";

const CAPABILITIES = [
  "Log a sale or an expense — “I spent RM45 on petrol today, cash.”",
  "Ask about your money — “How much profit did I make this month?”",
  "See who owes you and draft a reminder.",
  "Draft an e-invoice, or just say “open my invoices.”",
];

function VoiceAgentInner() {
  const agent = useVoiceAgent();
  const connected = agent.status === "connected";
  const stateLabel = agent.status === "connecting" || agent.connecting
    ? "Connecting…"
    : connected
      ? agent.isSpeaking
        ? "Assistant speaking"
        : agent.isListening
          ? "Listening…"
          : "Connected"
      : "Not connected";

  return (
    <div className="voice-agent">
      <section className="voice-stage" aria-label="Voice assistant">
        <div className={`voice-orb${connected ? " active" : ""}${agent.isSpeaking ? " speaking" : ""}`} aria-hidden="true">
          <AudioLines size={40} />
        </div>
        <p className="voice-state" role="status" aria-live="polite">{stateLabel}</p>

        <div className="voice-controls">
          {connected ? (
            <>
              <button className="button button-secondary" onClick={agent.toggleMute} type="button" aria-pressed={agent.isMuted}>
                {agent.isMuted ? <MicOff aria-hidden="true" size={18} /> : <Mic aria-hidden="true" size={18} />}
                {agent.isMuted ? "Unmute" : "Mute"}
              </button>
              <button className="button button-danger" onClick={agent.disconnect} type="button">
                <PhoneOff aria-hidden="true" size={18} />End conversation
              </button>
            </>
          ) : (
            <button className="button button-primary" disabled={!agent.canConnect || agent.connecting} onClick={agent.connect} type="button">
              <Mic aria-hidden="true" size={18} />Start talking
            </button>
          )}
        </div>

        {agent.error ? <p className="form-alert" role="alert">{agent.error}</p> : null}
        <p className="voice-privacy-note">Records are staged for your review and saved only after you confirm. This is a local demo — nothing is submitted to MyInvois or a bank.</p>
      </section>

      <div className="voice-side">
        <VoiceDraftReview />
        <section className="voice-capabilities" aria-label="What you can ask">
          <h2>Try saying</h2>
          <ul>
            {CAPABILITIES.map((capability) => <li key={capability}>{capability}</li>)}
          </ul>
        </section>
      </div>
    </div>
  );
}

export function VoiceAgentPanel() {
  const { data: business, isLoading } = useBusiness();

  return (
    <div className="voice-page">
      <PageHeader
        eyebrow="Voice assistant"
        title="Talk to NiagaAI"
        description="Have a live conversation to capture records, check your numbers, and prepare invoices — hands-free."
      />
      {isLoading ? (
        <p className="voice-privacy-note">Loading your workspace…</p>
      ) : !business ? (
        <p className="form-alert" role="alert">Set up your business details first, then come back to use the voice assistant.</p>
      ) : (
        <ConversationProvider>
          <VoiceAgentInner />
        </ConversationProvider>
      )}
    </div>
  );
}
