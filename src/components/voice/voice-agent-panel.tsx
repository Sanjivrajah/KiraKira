"use client";

import { ChevronDown, ClipboardCheck, Clock3, History, Mic, MicOff, PhoneOff, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { useBusiness } from "@/hooks/use-business";
import { usePersistentVoiceAgent } from "./voice-agent-provider";
import { VoiceCaptions } from "./voice-captions";
import { VoiceDraftReview } from "./voice-draft-review";
import { VoiceOrb } from "./voice-orb";
import { VoiceConversationHistory } from "./voice-conversation-history";

const CAPABILITIES = [
  "I spent RM45 on petrol today, cash.",
  "How much profit did I make this month?",
  "Who still owes me money?",
  "Draft an invoice for Siti.",
];

function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function VoiceSessionTimer() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  return <span className="voice-session-time"><Clock3 aria-hidden="true" size={14} />{formatDuration(seconds)}</span>;
}

function VoiceAgentInner() {
  const agent = usePersistentVoiceAgent();
  const { data: business } = useBusiness();
  const [historyOpen, setHistoryOpen] = useState(false);
  const connected = agent.status === "connected";
  const active = connected || agent.connecting || agent.status === "connecting";
  const savesTranscripts = agent.transcriptStorage !== "disabled";

  return (
    <div className="voice-agent">
      <section className="voice-stage" data-phase={agent.phase} aria-label="Voice assistant">
        <div className="voice-stage-topline">
          <span className="voice-live-badge" data-active={active || undefined}>
            <span aria-hidden="true" />{connected ? "Live conversation" : active ? "Connecting" : "Voice workspace"}
          </span>
          {connected ? <VoiceSessionTimer /> : <span className="voice-secure-label"><ShieldCheck aria-hidden="true" size={15} />Audio is not stored</span>}
        </div>

        <div className="voice-stage-body">
          <div className="voice-presence">
            <VoiceOrb phase={agent.phase} getInputVolume={agent.getInputVolume} getOutputVolume={agent.getOutputVolume} />
            <div className="voice-phase-copy">
              <p className="voice-state" data-phase={agent.phase} role="status" aria-live="polite">{agent.stateLabel}</p>
              <p className="voice-state-hint">{agent.stateHint}</p>
            </div>

            <div className="voice-controls" aria-label="Conversation controls">
              {connected ? (
                <>
                  <button className="voice-control-button voice-control-mute" onClick={agent.toggleMute} type="button" aria-pressed={agent.isMuted}>
                    <span className="voice-control-icon">{agent.isMuted ? <MicOff aria-hidden="true" size={21} /> : <Mic aria-hidden="true" size={21} />}</span>
                    {agent.isMuted ? "Unmute" : "Mute"}
                  </button>
                  <button className="voice-control-button voice-control-end" onClick={agent.disconnect} type="button">
                    <span className="voice-control-icon"><PhoneOff aria-hidden="true" size={21} /></span>
                    End call
                  </button>
                </>
              ) : (
                <button className="voice-start-button" disabled={!agent.canConnect || agent.connecting} onClick={() => void agent.connect()} type="button">
                  <span><Mic aria-hidden="true" size={22} /></span>{agent.connecting ? "Connecting…" : "Start talking"}
                </button>
              )}
            </div>
          </div>

          <div className="voice-dialogue">
            {agent.phase === "idle" && agent.transcript.length === 0 ? (
              <section className="voice-prompts" aria-labelledby="voice-prompts-title">
                <p className="voice-section-label" id="voice-prompts-title"><Sparkles aria-hidden="true" size={15} />Try saying</p>
                <div className="voice-prompt-list">
                  {CAPABILITIES.map((capability) => <span className="voice-prompt-chip" key={capability}>“{capability}”</span>)}
                </div>
              </section>
            ) : null}
            <VoiceCaptions transcript={agent.transcript} />
          </div>
        </div>

        <div className="voice-stage-footer">
          <p className="voice-privacy-note">
            <ShieldCheck aria-hidden="true" size={16} />
            <span>{savesTranscripts
              ? "Private text transcripts are marked for deletion after 90 days. Audio is not stored, and financial records are saved only after you confirm."
              : "This demo does not save the transcript. Financial records are staged for review and saved only after you confirm."}</span>
          </p>
          {agent.transcriptStorage === "saving" ? <p className="voice-storage-state" role="status">Saving transcript…</p> : null}
        </div>
        {agent.error ? <p className="form-alert voice-stage-alert" role="alert">{agent.error}</p> : null}
        {agent.transcriptStorage === "error" ? <p className="form-alert voice-stage-alert" role="alert">The conversation can continue, but its transcript is not being saved.</p> : null}
      </section>

      <section className="voice-review-section" aria-labelledby="voice-review-title">
        <header className="voice-review-heading">
          <div>
            <p>Owner confirmation</p>
            <h2 id="voice-review-title"><ClipboardCheck aria-hidden="true" size={20} />Review queue</h2>
          </div>
          <span>Nothing saves automatically</span>
        </header>
        <VoiceDraftReview />
      </section>

      {business && savesTranscripts ? (
        <section className="voice-history-shell">
          <button className="voice-history-toggle" aria-expanded={historyOpen} onClick={() => setHistoryOpen((open) => !open)} type="button">
            <span><History aria-hidden="true" size={19} /><span><strong>Conversation history</strong><small>Review private text transcripts from previous calls</small></span></span>
            <ChevronDown aria-hidden="true" className={historyOpen ? "is-open" : ""} size={20} />
          </button>
          {historyOpen ? <VoiceConversationHistory businessId={business.id} refreshKey={agent.historyRefreshKey} /> : null}
        </section>
      ) : null}
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
        <VoiceAgentInner />
      )}
    </div>
  );
}
