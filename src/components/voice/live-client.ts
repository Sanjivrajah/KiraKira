import type { ClientEvent } from "openai/resources/live/live";
import { parseLiveServerEvent, type LiveVoiceEvent } from "./live-protocol";

const DATA_CHANNEL_LABEL = "oai-events";
const ICE_GATHERING_TIMEOUT_MS = 10_000;
const GRACEFUL_CLOSE_TIMEOUT_MS = 5_000;

/** Browser media seams, injectable so the client can be tested without WebRTC. */
export interface LiveMedia {
  getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>;
  createPeerConnection(): RTCPeerConnection;
  createAudioElement(): HTMLAudioElement;
}

export interface LiveVoiceConnection {
  sessionId: string;
  /** Sends a client event; dropped unless the channel is open and the session is not closing. */
  send(event: ClientEvent): void;
  setMuted(muted: boolean): void;
  /** Current mic / assistant level, 0–1. */
  getInputVolume(): number;
  getOutputVolume(): number;
  /** Ends the session gracefully and releases the mic. Safe to call repeatedly. */
  close(): Promise<void>;
}

export interface ConnectLiveVoiceOptions {
  /** Exchanges the local SDP offer for the session's SDP answer (via our server). */
  requestAnswer(offerSdp: string): Promise<{ sdp: string; sessionId: string }>;
  onEvent(event: LiveVoiceEvent): void;
  /**
   * Called once when the session ends without the app asking to close: the
   * server's `session.closed` reason (e.g. `expired`), or `connection_lost`.
   */
  onEnded(reason: string): void;
  media?: LiveMedia;
}

function browserMedia(): LiveMedia {
  return {
    getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
    createPeerConnection: () => new RTCPeerConnection(),
    createAudioElement: () => {
      const audio = new Audio();
      audio.autoplay = true;
      return audio;
    },
  };
}

function waitForIceGathering(peer: RTCPeerConnection) {
  if (peer.iceGatheringState === "complete") return Promise.resolve();
  return new Promise<void>((resolve) => {
    // Proceed with the candidates gathered so far rather than failing outright.
    const timer = setTimeout(done, ICE_GATHERING_TIMEOUT_MS);
    function done() {
      clearTimeout(timer);
      peer.removeEventListener("icegatheringstatechange", onChange);
      resolve();
    }
    function onChange() {
      if (peer.iceGatheringState === "complete") done();
    }
    peer.addEventListener("icegatheringstatechange", onChange);
  });
}

/** RMS level meter over a media stream; returns a no-op meter when Web Audio is unavailable. */
function createLevelMeter(context: AudioContext | null, stream: MediaStream) {
  if (!context) return () => 0;
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  context.createMediaStreamSource(stream).connect(analyser);
  const samples = new Float32Array(analyser.fftSize);
  return () => {
    analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    for (const sample of samples) sum += sample * sample;
    return Math.min(1, Math.sqrt(sum / samples.length) * 4);
  };
}

/**
 * Opens a WebRTC connection to an OpenAI Live session. Audio flows on media
 * tracks; JSON events flow on the `oai-events` data channel. The SDP exchange
 * goes through our server so the API key never reaches the browser.
 */
export async function connectLiveVoice(options: ConnectLiveVoiceOptions): Promise<LiveVoiceConnection> {
  const media = options.media ?? browserMedia();
  let microphone: MediaStream | null = null;
  let peer: RTCPeerConnection | null = null;
  let channel: RTCDataChannel | null = null;
  let audioContext: AudioContext | null = null;
  const audio = media.createAudioElement();
  let closing = false;
  let closePromise: Promise<void> | null = null;
  let resolveClosed: (() => void) | null = null;
  let inputLevel = () => 0;
  let outputLevel = () => 0;

  const release = () => {
    microphone?.getTracks().forEach((track) => track.stop());
    channel?.close();
    peer?.close();
    void audioContext?.close().catch(() => undefined);
    audio.pause?.();
    audio.srcObject = null;
  };

  const end = (reason: string) => {
    if (closing) return;
    closing = true;
    release();
    options.onEnded(reason);
  };
  const lost = () => end("connection_lost");

  try {
    microphone = await media.getUserMedia({ audio: true });
    peer = media.createPeerConnection();
    const activePeer = peer;
    const AudioContextConstructor = typeof window === "undefined" ? undefined : window.AudioContext;
    audioContext = AudioContextConstructor ? new AudioContextConstructor() : null;
    inputLevel = createLevelMeter(audioContext, microphone);

    for (const track of microphone.getTracks()) activePeer.addTrack(track, microphone);
    activePeer.addEventListener("track", (event) => {
      const remote = new MediaStream([event.track]);
      audio.srcObject = remote;
      outputLevel = createLevelMeter(audioContext, remote);
      void audio.play().catch(() => undefined);
    });
    activePeer.addEventListener("connectionstatechange", () => {
      if (activePeer.connectionState === "failed") lost();
    });

    channel = activePeer.createDataChannel(DATA_CHANNEL_LABEL);
    channel.addEventListener("message", (message: MessageEvent) => {
      if (typeof message.data !== "string") return;
      const event = parseLiveServerEvent(message.data);
      if (!event) return;
      options.onEvent(event);
      if (event.kind !== "closed") return;
      // An app-requested close waits for this; otherwise the server ended the session.
      if (resolveClosed) resolveClosed();
      else end(event.reason ?? "connection_lost");
    });
    channel.addEventListener("close", () => lost());

    const offer = await activePeer.createOffer();
    await activePeer.setLocalDescription(offer);
    await waitForIceGathering(activePeer);
    const offerSdp = activePeer.localDescription?.sdp ?? offer.sdp ?? "";
    const answer = await options.requestAnswer(offerSdp);
    await activePeer.setRemoteDescription({ type: "answer", sdp: answer.sdp });

    const rawSend = (event: ClientEvent) => {
      if (channel?.readyState === "open") channel.send(JSON.stringify(event));
    };
    // Once closing starts, late tool results must not reach the session.
    const send = (event: ClientEvent) => {
      if (!closing) rawSend(event);
    };

    return {
      sessionId: answer.sessionId,
      send,
      setMuted(muted) {
        microphone?.getAudioTracks().forEach((track) => { track.enabled = !muted; });
        send({ type: muted ? "session.input_audio.mute" : "session.input_audio.unmute" });
      },
      getInputVolume: () => inputLevel(),
      getOutputVolume: () => outputLevel(),
      close() {
        if (closePromise) return closePromise;
        const alreadyLost = closing;
        closing = true;
        closePromise = (async () => {
          if (alreadyLost) return;
          if (channel?.readyState === "open") {
            // Keep media alive until the session confirms it closed (or we give up).
            await new Promise<void>((resolve) => {
              const timer = setTimeout(resolve, GRACEFUL_CLOSE_TIMEOUT_MS);
              resolveClosed = () => { clearTimeout(timer); resolve(); };
              rawSend({ type: "session.close" });
            });
          }
          release();
        })();
        return closePromise;
      },
    };
  } catch (error) {
    closing = true;
    release();
    throw error;
  }
}
