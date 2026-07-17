"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/query-keys";
import { resolveVoiceOwnerName } from "@/lib/voice/owner-name";
import { services } from "@/services";
import { useAuth } from "@/components/auth/auth-provider";
import { useBusiness } from "@/hooks/use-business";
import { createVoiceClientTools, type VoiceDraftController } from "./client-tools";
import { kualaLumpurToday } from "./voice-finance";
import { useVoiceDraftStore } from "./voice-draft-store";
import { appendTranscriptTurn, type TranscriptTurn } from "./voice-transcript";
import {
  finishStoredVoiceConversation,
  saveStoredVoiceTurn,
  startStoredVoiceConversation,
} from "./voice-conversation-api";

// The store actions are stable, so a single controller instance stays valid for the session.
const draftController: VoiceDraftController = {
  setTransaction: (draft) => useVoiceDraftStore.getState().setTransaction(draft),
  patchTransaction: (patch) => useVoiceDraftStore.getState().patchTransaction(patch),
  getTransaction: () => useVoiceDraftStore.getState().transaction,
  clearTransaction: () => useVoiceDraftStore.getState().clearTransaction(),
  setInvoice: (draft) => useVoiceDraftStore.getState().setInvoice(draft),
  getInvoice: () => useVoiceDraftStore.getState().invoice,
  clearInvoice: () => useVoiceDraftStore.getState().clearInvoice(),
  setReminder: (draft) => useVoiceDraftStore.getState().setReminder(draft),
  setLastConfirmation: (confirmation) => useVoiceDraftStore.getState().setLastConfirmation(confirmation),
};

/**
 * The single "emotion" the UI renders. Derived from the raw SDK flags so the
 * orb and status label never juggle overlapping booleans.
 */
export type VoicePhase =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "muted"
  | "error";

/** Concise phase copy shared by the visible status and its supporting hint. */
export const VOICE_PHASE_COPY: Record<VoicePhase, { label: string; hint: string }> = {
  idle: { label: "Ready when you are", hint: "Start a conversation and speak naturally." },
  connecting: { label: "Getting everything ready", hint: "Connecting securely to your microphone…" },
  listening: { label: "I’m listening", hint: "Tell me about a sale, expense, invoice, or your numbers." },
  thinking: { label: "Working that out", hint: "Checking the details before I answer." },
  speaking: { label: "NiagaAI is answering", hint: "You can interrupt naturally or mute your microphone." },
  muted: { label: "Microphone paused", hint: "Unmute when you’re ready to continue." },
  error: { label: "The conversation paused", hint: "Review the message below, then try again." },
};

export interface UseVoiceAgentResult {
  status: "disconnected" | "connecting" | "connected" | "error";
  phase: VoicePhase;
  stateLabel: string;
  stateHint: string;
  connecting: boolean;
  canConnect: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  isMuted: boolean;
  error: string | null;
  transcript: TranscriptTurn[];
  transcriptStorage: "disabled" | "idle" | "saving" | "saved" | "error";
  historyRefreshKey: number;
  /** Stable getters for the current mic / assistant output level (0–1). */
  getInputVolume: () => number;
  getOutputVolume: () => number;
  connect: () => Promise<void>;
  disconnect: () => void;
  toggleMute: () => void;
}

export function useVoiceAgent(): UseVoiceAgentResult {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { mode, session } = useAuth();
  const { data: business } = useBusiness();

  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [transcriptStorage, setTranscriptStorage] = useState<UseVoiceAgentResult["transcriptStorage"]>(
    mode === "supabase" ? "idle" : "disabled",
  );
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  // Best-effort "thinking" signal: the user's turn has landed but the assistant
  // has not started speaking yet. Cleared once the assistant replies (below).
  const [awaitingReply, setAwaitingReply] = useState(false);

  // Read live inside long-lived tool closures without re-creating the session.
  const businessName = business?.name ?? "your business";
  const pathnameRef = useRef(pathname);
  const businessNameRef = useRef(businessName);
  const businessIdRef = useRef(business?.id ?? null);
  const authModeRef = useRef(mode);
  const transcriptRef = useRef<TranscriptTurn[]>([]);
  const storageSessionRef = useRef<Promise<string | null> | null>(null);
  const storageQueueRef = useRef<Promise<void>>(Promise.resolve());
  const connectInFlightRef = useRef(false);
  const endInFlightRef = useRef(false);
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);
  useEffect(() => { businessNameRef.current = businessName; }, [businessName]);
  useEffect(() => { businessIdRef.current = business?.id ?? null; }, [business?.id]);
  useEffect(() => { authModeRef.current = mode; }, [mode]);

  const queueTranscriptTurn = useCallback((turn: TranscriptTurn) => {
    const session = storageSessionRef.current;
    if (!session) return;
    setTranscriptStorage("saving");
    const operation = storageQueueRef.current.then(async () => {
      const conversationId = await session;
      if (conversationId) await saveStoredVoiceTurn(conversationId, turn);
    });
    storageQueueRef.current = operation.catch(() => { setTranscriptStorage("error"); });
    void operation.then(() => setTranscriptStorage("saved"), () => setTranscriptStorage("error"));
  }, []);

  const finishTranscriptStorage = useCallback((status: "completed" | "failed") => {
    const session = storageSessionRef.current;
    if (!session) return;
    storageSessionRef.current = null;
    const operation = storageQueueRef.current.then(async () => {
      const conversationId = await session;
      if (conversationId) await finishStoredVoiceConversation(conversationId, status);
    });
    storageQueueRef.current = operation.catch(() => { setTranscriptStorage("error"); });
    void operation.then(() => {
      setTranscriptStorage("saved");
      setHistoryRefreshKey((key) => key + 1);
    }, () => setTranscriptStorage("error"));
  }, []);

  const conversation = useConversation({
    onMessage: ({ message, source }) => {
      const previous = transcriptRef.current;
      const next = appendTranscriptTurn(previous, { message, source });
      transcriptRef.current = next;
      setTranscript(next);
      const latest = next[next.length - 1];
      if (latest && next !== previous) queueTranscriptTurn(latest);
      // A user turn opens the "thinking" gap; an assistant turn closes it.
      setAwaitingReply(source === "user");
    },
    onError: (message, context) => {
      console.error("[voice] error", message, context);
      setError(typeof message === "string" && message ? message : "The voice assistant hit a problem.");
    },
    onDisconnect: (details) => {
      finishTranscriptStorage(details.reason === "error" || details.reason === "agent" ? "failed" : "completed");
      if (details.reason === "error") {
        console.error("[voice] disconnected", details);
        setError(details.message || details.closeReason || "The voice session ended unexpectedly.");
      } else if (details.reason === "agent") {
        console.warn("[voice] agent ended session", details);
        setError(details.closeReason || details.context?.reason || "The assistant ended the session. Check the agent configuration in ElevenLabs.");
      } else {
        // User-initiated stop (or a clean close). Not an error — log quietly so
        // the Next.js dev overlay doesn't surface it.
        console.info("[voice] session ended", details);
      }
    },
    onConnect: ({ conversationId }) => {
      const currentBusinessId = businessIdRef.current;
      if (authModeRef.current !== "supabase" || !currentBusinessId) return;
      setTranscriptStorage("saving");
      const session = startStoredVoiceConversation(currentBusinessId, conversationId);
      storageSessionRef.current = session;
      void session.then(
        (storedId) => setTranscriptStorage(storedId ? "saved" : "disabled"),
        () => setTranscriptStorage("error"),
      );
    },
  });

  const businessId = business?.id ?? null;
  const createdBy = session?.user.id ?? "";
  const canConnect = Boolean(businessId) && conversation.status === "disconnected";

  const connect = useCallback(async () => {
    if (connectInFlightRef.current) return;
    if (!businessId) {
      setError("Set up your business before using the voice assistant.");
      return;
    }
    connectInFlightRef.current = true;
    setError(null);
    setConnecting(true);
    setTranscript([]);
    transcriptRef.current = [];
    setAwaitingReply(false);
    setTranscriptStorage(mode === "supabase" ? "idle" : "disabled");
    storageSessionRef.current = null;
    storageQueueRef.current = Promise.resolve();
    try {
      const response = await fetch("/api/voice/session", { headers: { Accept: "application/json" } });
      if (!response.ok) {
        setError(response.status === 503
          ? "The voice assistant isn't configured yet."
          : response.status === 401
            ? "Sign in again to use the voice assistant."
            : "Couldn't start the voice assistant. Please try again.");
        return;
      }
      const { token, ownerName } = (await response.json()) as { token?: string; ownerName?: string };
      if (!token) {
        setError("The voice assistant returned no session. Please try again.");
        return;
      }

      const invalidateTransactions = () => Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.transactions.list(businessId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(businessId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.loanReadiness(businessId) }),
      ]);
      const invalidateInvoices = () => Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.invoices.list(businessId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(businessId) }),
      ]);

      const clientTools = createVoiceClientTools({
        businessId,
        createdBy,
        draft: draftController,
        listTransactions: () => services.transactions.initializeDemo(businessId),
        createTransaction: async (input) => {
          const created = await services.transactions.create(input);
          await invalidateTransactions();
          return created;
        },
        listInvoices: () => services.invoices.initializeDemo(businessId),
        nextInvoiceNumber: () => services.invoices.nextInvoiceNumber(businessId),
        createInvoice: async (input) => {
          const created = await services.invoices.create(input);
          await invalidateInvoices();
          return created;
        },
        navigate: (href) => router.push(href),
        getContext: () => ({ pathname: pathnameRef.current, businessName: businessNameRef.current }),
      });

      conversation.startSession({
        conversationToken: token,
        connectionType: "webrtc",
        dynamicVariables: {
          business_name: businessNameRef.current,
          owner_name: resolveVoiceOwnerName(ownerName, session?.user.name),
          today: kualaLumpurToday(),
          currency: "MYR",
        },
        clientTools,
      });
    } catch {
      setError("Couldn't reach the microphone or the voice assistant. Check permissions and try again.");
    } finally {
      connectInFlightRef.current = false;
      setConnecting(false);
    }
  }, [businessId, createdBy, conversation, mode, queryClient, router, session]);

  const disconnect = useCallback(() => {
    if (endInFlightRef.current) return;
    endInFlightRef.current = true;
    conversation.endSession();
  }, [conversation]);

  useEffect(() => {
    if (conversation.status === "disconnected") endInFlightRef.current = false;
  }, [conversation.status]);

  const toggleMute = useCallback(() => {
    conversation.setMuted(!conversation.isMuted);
  }, [conversation]);

  // `useConversation()` returns a fresh object every render, so keep the latest
  // endSession in a ref and only invoke it on unmount — depending on
  // `conversation` here would tear the session down on every re-render.
  const endSessionRef = useRef(conversation.endSession);
  useEffect(() => { endSessionRef.current = conversation.endSession; });
  useEffect(() => () => {
    endSessionRef.current();
    finishTranscriptStorage("completed");
  }, [finishTranscriptStorage]);

  // Volume getters change identity every render too; expose stable wrappers so
  // the orb's animation loop isn't torn down and rebuilt on each re-render.
  const getInputVolumeRef = useRef(conversation.getInputVolume);
  const getOutputVolumeRef = useRef(conversation.getOutputVolume);
  useEffect(() => {
    getInputVolumeRef.current = conversation.getInputVolume;
    getOutputVolumeRef.current = conversation.getOutputVolume;
  });
  const getInputVolume = useCallback(() => {
    try { return getInputVolumeRef.current(); } catch { return 0; }
  }, []);
  const getOutputVolume = useCallback(() => {
    try { return getOutputVolumeRef.current(); } catch { return 0; }
  }, []);

  const { status, isSpeaking, isListening, isMuted } = conversation;
  const phase: VoicePhase = error
    ? "error"
    : status === "connecting" || connecting
      ? "connecting"
      : status !== "connected"
        ? "idle"
        : isMuted
          ? "muted"
          : isSpeaking
            ? "speaking"
            : awaitingReply
              ? "thinking"
              : "listening"; // connected and not otherwise busy = waiting for you

  return {
    status,
    phase,
    stateLabel: VOICE_PHASE_COPY[phase].label,
    stateHint: VOICE_PHASE_COPY[phase].hint,
    connecting,
    canConnect,
    isSpeaking,
    isListening,
    isMuted,
    error,
    transcript,
    transcriptStorage,
    historyRefreshKey,
    getInputVolume,
    getOutputVolume,
    connect,
    disconnect,
    toggleMute,
  };
}
