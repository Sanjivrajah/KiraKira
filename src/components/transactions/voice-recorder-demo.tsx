"use client";

import { useEffect, useRef, useState } from "react";
import { CircleStop, Mic, UploadCloud } from "lucide-react";

const transcript = "Today I bought 20 boxes of mineral water for RM240 from ABC Supplier.";

const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

export function VoiceRecorderDemo({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [hasAudio, setHasAudio] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  const stopRecording = () => {
    setRecording(false);
    setHasAudio(true);
  };

  return (
    <section className="capture-input-card" aria-labelledby="voice-demo-title">
      <p className="section-kicker">Voice note · Step 1 of 3</p>
      <h2 id="voice-demo-title">Tell us what happened</h2>
      <p className="capture-help">This timer is a visual demo. NiagaAI does not access your microphone or perform speech-to-text.</p>

      <div className={`recorder-demo${recording ? " recording" : ""}`}>
        <span className="recorder-pulse"><Mic aria-hidden="true" size={28} /></span>
        <strong>{recording ? "Demo recording in progress" : hasAudio ? "Voice note ready" : "Ready to record"}</strong>
        <span className="recording-time" aria-live="polite">{formatTime(seconds)}</span>
        <button
          className={`button ${recording ? "button-danger" : "button-primary"}`}
          onClick={() => recording ? stopRecording() : (setSeconds(0), setHasAudio(false), setFileName(""), setRecording(true))}
          type="button"
        >
          {recording ? <><CircleStop aria-hidden="true" size={18} />Stop demo recording</> : <><Mic aria-hidden="true" size={18} />Start demo recording</>}
        </button>
      </div>

      <div className="upload-alternative"><span>or</span></div>
      <button className="file-picker-row" onClick={() => fileRef.current?.click()} type="button">
        <UploadCloud aria-hidden="true" size={20} />
        <span><strong>Upload an audio file</strong><small>{fileName || "MP3, M4A, or WAV"}</small></span>
      </button>
      <input accept="audio/*" className="visually-hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) { setFileName(file.name); setHasAudio(true); setRecording(false); } }} ref={fileRef} type="file" />

      {hasAudio ? <div className="transcript-preview"><span>Sample transcript</span><p>“{transcript}”</p></div> : null}
      <div className="capture-actions">
        <button className="button button-secondary" onClick={onBack} type="button">Back</button>
        <button className="button button-primary" disabled={!hasAudio} onClick={onContinue} type="button">Use sample transcript</button>
      </div>
    </section>
  );
}
