"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/query-keys";
import { services } from "@/services";
import { useAuth } from "@/components/auth/auth-provider";
import { useBusiness } from "@/hooks/use-business";
import { createVoiceClientTools, type VoiceDraftController } from "./client-tools";
import { kualaLumpurToday } from "./voice-finance";
import { useVoiceDraftStore } from "./voice-draft-store";
import { appendTranscriptTurn, type TranscriptTurn } from "./voice-transcript";

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

/** Human-readable label for each phase, announced via an aria-live region. */
export const VOICE_PHASE_LABEL: Record<VoicePhase, string> = {
  idle: "Not connected",
  connecting: "Connecting…",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Assistant speaking",
  muted: "Muted",
  error: "Something went wrong",
};

export interface UseVoiceAgentResult {
  status: "disconnected" | "connecting" | "connected" | "error";
  phase: VoicePhase;
  stateLabel: string;
  connecting: boolean;
  canConnect: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  isMuted: boolean;
  error: string | null;
  transcript: TranscriptTurn[];
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
  const { session } = useAuth();
  const { data: business } = useBusiness();

  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  // Best-effort "thinking" signal: the user's turn has landed but the assistant
  // has not started speaking yet. Cleared once the assistant replies (below).
  const [awaitingReply, setAwaitingReply] = useState(false);

  // Read live inside long-lived tool closures without re-creating the session.
  const businessName = business?.name ?? "your business";
  const pathnameRef = useRef(pathname);
  const businessNameRef = useRef(businessName);
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);
  useEffect(() => { businessNameRef.current = businessName; }, [businessName]);

  const conversation = useConversation({
    onMessage: ({ message, source }) => {
      setTranscript((turns) => appendTranscriptTurn(turns, { message, source }));
      // A user turn opens the "thinking" gap; an assistant turn closes it.
      setAwaitingReply(source === "user");
    },
    onError: (message, context) => {
      console.error("[voice] error", message, context);
      setError(typeof message === "string" && message ? message : "The voice assistant hit a problem.");
    },
    onDisconnect: (details) => {
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
    onConnect: ({ conversationId }) => console.info("[voice] connected", conversationId),
  });

  const businessId = business?.id ?? null;
  const createdBy = session?.user.id ?? "";
  const canConnect = Boolean(businessId) && conversation.status === "disconnected";

  const connect = useCallback(async () => {
    if (!businessId) {
      setError("Set up your business before using the voice assistant.");
      return;
    }
    setError(null);
    setConnecting(true);
    setTranscript([]);
    setAwaitingReply(false);
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
      const { token } = (await response.json()) as { token?: string };
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
          owner_name: session?.user.email?.split("@")[0] ?? "there",
          today: kualaLumpurToday(),
          currency: "MYR",
        },
        clientTools,
      });
    } catch {
      setError("Couldn't reach the microphone or the voice assistant. Check permissions and try again.");
    } finally {
      setConnecting(false);
    }
  }, [businessId, createdBy, conversation, queryClient, router, session]);

  const disconnect = useCallback(() => {
    conversation.endSession();
  }, [conversation]);

  const toggleMute = useCallback(() => {
    conversation.setMuted(!conversation.isMuted);
  }, [conversation]);

  // `useConversation()` returns a fresh object every render, so keep the latest
  // endSession in a ref and only invoke it on unmount — depending on
  // `conversation` here would tear the session down on every re-render.
  const endSessionRef = useRef(conversation.endSession);
  useEffect(() => { endSessionRef.current = conversation.endSession; });
  useEffect(() => () => { endSessionRef.current(); }, []);

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
    stateLabel: VOICE_PHASE_LABEL[phase],
    connecting,
    canConnect,
    isSpeaking,
    isListening,
    isMuted,
    error,
    transcript,
    getInputVolume,
    getOutputVolume,
    connect,
    disconnect,
    toggleMute,
  };
}
