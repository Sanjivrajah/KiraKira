"use client";

import { MessageSquare } from "lucide-react";
import { useEffect, useRef } from "react";
import type { TranscriptTurn } from "./voice-transcript";

interface VoiceCaptionsProps {
  transcript: TranscriptTurn[];
}

/**
 * Live captions for the conversation. Rendered as an aria-live log so screen
 * reader users hear new turns, and auto-scrolled so the newest turn stays in
 * view. Shows a quiet prompt until the first words are spoken.
 */
export function VoiceCaptions({ transcript }: VoiceCaptionsProps) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [transcript.length]);

  return (
    <section className="voice-captions" aria-label="Live transcript">
      <h2 className="voice-captions-heading">
        <MessageSquare aria-hidden="true" size={16} />
        Live transcript
      </h2>
      {transcript.length === 0 ? (
        <p className="voice-captions-empty">What you and the assistant say will appear here as you talk.</p>
      ) : (
        <div className="voice-captions-log" ref={logRef} role="log" aria-live="polite" aria-atomic="false" tabIndex={0}>
          {transcript.map((turn) => (
            <p key={turn.id} className="voice-caption" data-role={turn.role}>
              <span className="voice-caption-who">{turn.role === "user" ? "You" : "Assistant"}</span>
              <span className="voice-caption-text">{turn.text}</span>
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
