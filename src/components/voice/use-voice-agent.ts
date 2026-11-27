"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/query-keys";
import { services } from "@/services";
import { useAuth } from "@/components/auth/auth-provider";
import { useBusiness } from "@/hooks/use-business";
import { createVoiceClientTools, type VoiceDraftController } from "./client-tools";
import { createVoiceCustomerResolver } from "./voice-customers";
import { isCurrentVoiceDestination } from "./voice-navigation";
import { useVoiceDraftStore } from "./voice-draft-store";
import { useVoiceUiBus } from "./voice-ui-bus";
import { appendTranscriptDelta, type TranscriptTurn } from "./voice-transcript";
import { connectLiveVoice, type LiveVoiceConnection } from "./live-client";
import { runToolCalls, toolResultEvents, type LiveToolCall, type LiveToolHandler, type LiveVoiceEvent } from "./live-protocol";
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
  patchInvoice: (patch) => useVoiceDraftStore.getState().patchInvoice(patch),
  getInvoice: () => useVoiceDraftStore.getState().invoice,
  clearInvoice: () => useVoiceDraftStore.getState().clearInvoice(),
  setReminder: (draft) => useVoiceDraftStore.getState().setReminder(draft),
  getReminder: () => useVoiceDraftStore.getState().reminder,
  setPendingDelete: (draft) => useVoiceDraftStore.getState().setPendingDelete(draft),
  getPendingDelete: () => useVoiceDraftStore.getState().pendingDelete,
  setPendingPayment: (draft) => useVoiceDraftStore.getState().setPendingPayment(draft),
  getPendingPayment: () => useVoiceDraftStore.getState().pendingPayment,
  setCustomer: (draft) => useVoiceDraftStore.getState().setCustomer(draft),
  getCustomer: () => useVoiceDraftStore.getState().customer,
  setLastConfirmation: (confirmation) => useVoiceDraftStore.getState().setLastConfirmation(confirmation),
};

/**
 * The single "emotion" the UI renders. Derived from the connection state so the
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
  const [status, setStatus] = useState<UseVoiceAgentResult["status"]>("disconnected");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Read live inside long-lived tool closures without re-creating the session.
  const businessName = business?.name ?? "your business";
  const pathnameRef = useRef(pathname);
  const businessNameRef = useRef(businessName);
  const businessIdRef = useRef(business?.id ?? null);
  const businessRef = useRef(business ?? null);
  const authModeRef = useRef(mode);
  const transcriptRef = useRef<TranscriptTurn[]>([]);
  const storageSessionRef = useRef<Promise<string | null> | null>(null);
  const storageQueueRef = useRef<Promise<void>>(Promise.resolve());
  const connectInFlightRef = useRef(false);
  const endInFlightRef = useRef(false);
  const connectionRef = useRef<LiveVoiceConnection | null>(null);
  const toolsRef = useRef<Record<string, LiveToolHandler>>({});
  const pendingCallsRef = useRef(new Map<string, LiveToolCall[]>());
  const toolQueueRef = useRef<Promise<void>>(Promise.resolve());
  const speakingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);
  useEffect(() => { businessNameRef.current = businessName; }, [businessName]);
  useEffect(() => { businessIdRef.current = business?.id ?? null; }, [business?.id]);
  useEffect(() => { businessRef.current = business ?? null; }, [business]);
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


  const clearSpeaking = useCallback(() => {
    if (speakingTimerRef.current) clearTimeout(speakingTimerRef.current);
    speakingTimerRef.current = null;
    setIsSpeaking(false);
  }, []);

  /** Saves the newest caption turn (if any) and closes the stored conversation. */
  const endTranscript = useCallback((outcome: "completed" | "failed") => {
    const latest = transcriptRef.current[transcriptRef.current.length - 1];
    if (latest) queueTranscriptTurn(latest);
    finishTranscriptStorage(outcome);
  }, [finishTranscriptStorage, queueTranscriptTurn]);

  /** Tears down local session state after the connection is gone. */
  const settleDisconnected = useCallback(() => {
    connectionRef.current = null;
    pendingCallsRef.current.clear();
    clearSpeaking();
    setAwaitingReply(false);
    setIsMuted(false);
    setStatus("disconnected");
  }, [clearSpeaking]);

  const runPendingTools = useCallback((groupId: string) => {
    const calls = pendingCallsRef.current.get(groupId);
    pendingCallsRef.current.delete(groupId);
    if (!calls?.length) return;
    const owner = connectionRef.current;
    // Serialize batches so staged drafts are applied in the order the model asked.
    toolQueueRef.current = toolQueueRef.current.then(async () => {
      const results = await runToolCalls(calls, toolsRef.current);
      // The owner may have stopped the session while tools were running.
      if (!owner || connectionRef.current !== owner || endInFlightRef.current) return;
      for (const event of toolResultEvents(results)) owner.send(event);
    }).catch(() => undefined);
  }, []);

  const handleEvent = useCallback((event: LiveVoiceEvent) => {
    switch (event.kind) {
      case "started": {
        const currentBusinessId = businessIdRef.current;
        if (authModeRef.current !== "supabase" || !currentBusinessId) return;
        setTranscriptStorage("saving");
        const stored = startStoredVoiceConversation(currentBusinessId, event.sessionId);
        storageSessionRef.current = stored;
        void stored.then(
          (storedId) => setTranscriptStorage(storedId ? "saved" : "disabled"),
          () => setTranscriptStorage("error"),
        );
        return;
      }
      case "transcript": {
        const previous = transcriptRef.current;
        const next = appendTranscriptDelta(previous, event.role, event.delta);
        if (next === previous) return;
        transcriptRef.current = next;
        setTranscript(next);
        // A speaker change finalizes the previous turn, so persist it once.
        const finished = previous[previous.length - 1];
        const latest = next[next.length - 1];
        if (finished && latest && finished.id !== latest.id) queueTranscriptTurn(finished);
        if (event.role === "user") {
          setAwaitingReply(true);
          clearSpeaking();
        } else {
          setAwaitingReply(false);
          setIsSpeaking(true);
          // Live sends no "done speaking" event; treat a short pause in deltas as the end.
          if (speakingTimerRef.current) clearTimeout(speakingTimerRef.current);
          speakingTimerRef.current = setTimeout(() => setIsSpeaking(false), 700);
        }
        return;
      }
      case "function_call": {
        const calls = pendingCallsRef.current.get(event.groupId) ?? [];
        pendingCallsRef.current.set(event.groupId, [...calls, { callId: event.callId, name: event.name, arguments: event.arguments }]);
        return;
      }
      case "response_done":
        if (event.completed) {
          runPendingTools(event.groupId);
        } else {
          // A failed or truncated response may carry half-formed intent (e.g. a
          // confirm call the owner never approved); discard rather than act on it.
          pendingCallsRef.current.delete(event.groupId);
        }
        return;
      case "closed":
        // Server-initiated endings arrive through `onEnded`, which owns teardown.
        return;
      case "error":
        // Error events do not end a Live session; `session.closed` does. Log the
        // classification only and keep the conversation usable.
        console.warn("[voice] session error", { fatal: event.fatal });
        return;
    }
  }, [clearSpeaking, queueTranscriptTurn, runPendingTools]);

  const businessId = business?.id ?? null;
  const createdBy = session?.user.id ?? "";
  const canConnect = Boolean(businessId) && status === "disconnected";

  const connect = useCallback(async () => {
    if (connectInFlightRef.current || connectionRef.current) return;
    if (!businessId) {
      setError("Set up your business before using the voice assistant.");
      return;
    }
    connectInFlightRef.current = true;
    setError(null);
    setConnecting(true);
    setStatus("connecting");
    setTranscript([]);
    transcriptRef.current = [];
    setAwaitingReply(false);
    setIsMuted(false);
    setTranscriptStorage(mode === "supabase" ? "idle" : "disabled");
    storageSessionRef.current = null;
    storageQueueRef.current = Promise.resolve();
    pendingCallsRef.current.clear();
    try {
      const invalidateTransactions = () => Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.transactions.list(businessId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(businessId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.loanReadiness(businessId) }),
      ]);
      const invalidateInvoices = () => Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.invoices.list(businessId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.reminders.list(businessId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(businessId) }),
      ]);
      const customers = createVoiceCustomerResolver({ mode, businessId });

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
        updateTransaction: async (transaction) => {
          const updated = await services.transactions.update(transaction);
          await invalidateTransactions();
          return updated;
        },
        removeTransaction: async (transactionId) => {
          await services.transactions.remove(businessId, transactionId);
          await invalidateTransactions();
        },
        listInvoices: () => services.invoices.initializeDemo(businessId),
        nextInvoiceNumber: () => services.invoices.nextInvoiceNumber(businessId),
        createInvoice: async (input) => {
          const created = await services.invoices.create(input);
          await invalidateInvoices();
          return created;
        },
        updateInvoice: async (invoice) => {
          const updated = await services.invoices.update(invoice);
          await invalidateInvoices();
          return updated;
        },
        markReminderSent: async (invoice, messagePreview) => {
          await services.reminders.markSent(invoice, messagePreview);
          await invalidateInvoices();
        },
        listCustomers: () => customers.list(),
        createCustomer: (input) => customers.create(input),
        getBusinessContext: () => {
          const active = businessRef.current;
          if (!active) return null;
          const filled = (value?: string | null) => Boolean(value && value.trim());
          return {
            businessName: active.name,
            hasTin: filled(active.tin),
            hasSstRegistration: filled(active.sstRegistration),
            hasMsicCode: filled(active.msicCode),
            hasAddress: filled(active.addressLine1) || filled(active.city),
            hasRegistrationNumber: filled(active.registrationNumber),
          };
        },
        navigate: (href) => {
          // A same-route push refreshes dynamic pages such as the dashboard.
          // Keep the current document and live voice connection untouched when
          // the requested destination is already on screen.
          if (isCurrentVoiceDestination(window.location.href, href)) return;
          router.push(href);
        },
        getContext: () => ({ pathname: pathnameRef.current, businessName: businessNameRef.current }),
        dispatchUiCommand: (command) => useVoiceUiBus.getState().dispatch(command),
      });

      // Log tool names and outcomes only — never parameters, which hold amounts and names.
      toolsRef.current = Object.fromEntries(
        Object.entries(clientTools).map(([name, tool]) => [
          name,
          async (parameters: Record<string, unknown>) => {
            try {
              return await tool(parameters);
            } catch (error) {
              console.error(`[voice-tool] ${name} failed`);
              throw error;
            }
          },
        ]),
      );

      const ownerName = session?.user.name?.trim();
      const connection = await connectLiveVoice({
        requestAnswer: async (sdp) => {
          const response = await fetch("/api/voice/session", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ sdp, businessName: businessNameRef.current, ...(ownerName ? { ownerName } : {}) }),
          });
          if (!response.ok) throw new VoiceSessionRequestError(response.status);
          const body = (await response.json()) as { sdp?: unknown; sessionId?: unknown };
          if (typeof body.sdp !== "string" || typeof body.sessionId !== "string") throw new VoiceSessionRequestError(502);
          return { sdp: body.sdp, sessionId: body.sessionId };
        },
        onEvent: handleEvent,
        onEnded: (reason) => {
          if (endInFlightRef.current) return;
          const message = CLOSE_REASON_COPY[reason];
          if (message) setError(message);
          endTranscript(reason === "connection_lost" || reason === "content" ? "failed" : "completed");
          settleDisconnected();
        },
      });
      connectionRef.current = connection;
      setStatus("connected");
    } catch (error) {
      setStatus("disconnected");
      setError(connectErrorMessage(error));
    } finally {
      connectInFlightRef.current = false;
      setConnecting(false);
    }
  }, [businessId, createdBy, endTranscript, handleEvent, mode, queryClient, router, session, settleDisconnected]);

  const disconnect = useCallback(() => {
    const connection = connectionRef.current;
    if (!connection || endInFlightRef.current) return;
    endInFlightRef.current = true;
    void connection.close().finally(() => {
      endInFlightRef.current = false;
      endTranscript("completed");
      settleDisconnected();
    });
  }, [endTranscript, settleDisconnected]);

  const toggleMute = useCallback(() => {
    const connection = connectionRef.current;
    if (!connection) return;
    const next = !isMuted;
    connection.setMuted(next);
    setIsMuted(next);
  }, [isMuted]);

  // Leaving the app shell ends the session and releases the microphone.
  useEffect(() => () => {
    const connection = connectionRef.current;
    connectionRef.current = null;
    if (speakingTimerRef.current) clearTimeout(speakingTimerRef.current);
    if (!connection) return;
    endInFlightRef.current = true;
    void connection.close();
    endTranscript("completed");
  }, [endTranscript]);

  const getInputVolume = useCallback(() => connectionRef.current?.getInputVolume() ?? 0, []);
  const getOutputVolume = useCallback(() => connectionRef.current?.getOutputVolume() ?? 0, []);

  const isListening = status === "connected" && !isMuted && !isSpeaking;
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

/** Why the session ended, in words the owner can act on. `close_requested` is a normal stop. */
const CLOSE_REASON_COPY: Partial<Record<string, string>> = {
  expired: "The voice session timed out. Start again when you're ready.",
  content: "The assistant ended the session. Please start again.",
  connection_lost: "The voice connection dropped. Check your network and try again.",
};

class VoiceSessionRequestError extends Error {
  constructor(readonly status: number) {
    super("Voice session request failed.");
    this.name = "VoiceSessionRequestError";
  }
}

function connectErrorMessage(error: unknown) {
  if (error instanceof VoiceSessionRequestError) {
    if (error.status === 503) return "The voice assistant isn't configured yet.";
    if (error.status === 401) return "Sign in again to use the voice assistant.";
    if (error.status === 429) return "The voice assistant is busy. Try again in a moment.";
    return "Couldn't start the voice assistant. Please try again.";
  }
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Microphone access was blocked. Allow it in your browser settings and try again.";
  }
  return "Couldn't reach the microphone or the voice assistant. Check permissions and try again.";
}
