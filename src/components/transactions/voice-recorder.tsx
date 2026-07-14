"use client";

import { useEffect, useRef, useState } from "react";
import { CircleStop, LoaderCircle, Mic, UploadCloud } from "lucide-react";
import type { TransactionDraft } from "./transaction-review-form";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const MAX_RECORDING_SECONDS = 180;
const supportedExtensions = [".aac", ".flac", ".m4a", ".mp3", ".ogg", ".opus", ".wav", ".webm"];

export interface VoiceTransactionResult {
  transcript: string;
  languageCode: string | null;
  languageProbability: number | null;
  warnings: string[];
  draft: TransactionDraft;
}

const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

function recordingMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  return ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

export function VoiceRecorder({ onExtracted, onBack }: {
  onExtracted: (result: VoiceTransactionResult) => void;
  onBack: () => void;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audio, setAudio] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
    setRecording(false);
  };

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => {
      setSeconds((value) => {
        if (value + 1 >= MAX_RECORDING_SECONDS) {
          window.setTimeout(stopRecording, 0);
          return MAX_RECORDING_SECONDS;
        }
        return value + 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => () => {
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
    releaseStream();
  }, []);

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("This browser cannot record audio here. Upload an audio file instead.");
      return;
    }

    setError("");
    setAudio(null);
    setSeconds(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = recordingMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const extension = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        if (blob.size > 0) setAudio(new File([blob], `voice-note-${Date.now()}.${extension}`, { type }));
        else setError("The recording was empty. Try recording again or upload an audio file.");
        releaseStream();
      };
      recorder.start(1000);
      setRecording(true);
    } catch (cause) {
      releaseStream();
      setError(cause instanceof DOMException && cause.name === "NotAllowedError"
        ? "Microphone access was blocked. Allow access in your browser or upload an audio file."
        : "We could not start the microphone. Upload an audio file instead.");
    }
  };

  const chooseFile = (file: File | undefined) => {
    if (!file) return;
    stopRecording();
    const supported = file.type.startsWith("audio/") || supportedExtensions.some((extension) => file.name.toLowerCase().endsWith(extension));
    if (!supported) {
      setAudio(null);
      setError("Use an MP3, M4A, WAV, OGG, FLAC, AAC, or WEBM audio file.");
    } else if (file.size === 0 || file.size > MAX_AUDIO_BYTES) {
      setAudio(null);
      setError("Choose an audio file between 1 byte and 25 MB.");
    } else {
      setAudio(file);
      setError("");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const transcribe = async () => {
    if (!audio || processing) return;
    setError("");
    setProcessing(true);
    try {
      const body = new FormData();
      body.set("audio", audio);
      const response = await fetch("/api/audio/transcribe", { method: "POST", body });
      const result = await response.json().catch(() => ({})) as Partial<VoiceTransactionResult> & { error?: string };
      if (!response.ok || !result.draft || !result.transcript) {
        if (response.status === 429) throw new Error("Speech-to-text is busy. Wait a moment and try again.");
        if (response.status === 503) throw new Error("Speech-to-text is not configured right now.");
        throw new Error(result.error || `Could not process this voice note (${response.status}).`);
      }
      onExtracted({
        transcript: result.transcript,
        languageCode: result.languageCode || null,
        languageProbability: result.languageProbability ?? null,
        warnings: result.warnings || [],
        draft: result.draft,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not process this voice note.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <section className="capture-input-card" aria-labelledby="voice-recorder-title">
      <p className="section-kicker">Voice note · Step 1 of 3</p>
      <h2 id="voice-recorder-title">Tell us what happened</h2>
      <p className="capture-help">Mention whether money came in or went out, the amount, who it involved, and how you paid. You will review everything before saving.</p>

      <div className={`recorder-demo${recording ? " recording" : ""}`}>
        <span className="recorder-pulse"><Mic aria-hidden="true" size={28} /></span>
        <strong>{recording ? "Recording voice note" : audio ? "Voice note ready" : "Ready to record"}</strong>
        <span className="recording-time" aria-live="polite">{formatTime(seconds)}</span>
        <button
          className={`button ${recording ? "button-danger" : "button-primary"}`}
          disabled={processing}
          onClick={recording ? stopRecording : startRecording}
          type="button"
        >
          {recording ? <><CircleStop aria-hidden="true" size={18} />Stop recording</> : <><Mic aria-hidden="true" size={18} />{audio ? "Record again" : "Start recording"}</>}
        </button>
        <small>Maximum recording length: 3 minutes</small>
      </div>

      <div className="upload-alternative"><span>or</span></div>
      <button className="file-picker-row" disabled={processing || recording} onClick={() => fileRef.current?.click()} type="button">
        <UploadCloud aria-hidden="true" size={20} />
        <span><strong>Upload an audio file</strong><small>{audio?.name || "MP3, M4A, WAV, OGG, FLAC, AAC, or WEBM"}</small></span>
      </button>
      <input accept="audio/*,.m4a,.mp3,.wav,.ogg,.flac,.aac,.webm" className="visually-hidden" onChange={(event) => chooseFile(event.target.files?.[0])} ref={fileRef} type="file" />

      {error ? <p className="form-alert" role="alert">{error}</p> : null}
      <div className="capture-actions">
        <button className="button button-secondary" disabled={processing || recording} onClick={onBack} type="button">Back</button>
        <button className="button button-primary" disabled={!audio || processing || recording} onClick={transcribe} type="button">
          {processing ? <><LoaderCircle aria-hidden="true" className="spin" size={18} />Transcribing…</> : "Transcribe and review"}
        </button>
      </div>
    </section>
  );
}
