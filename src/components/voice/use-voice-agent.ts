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

export interface UseVoiceAgentResult {
  status: "disconnected" | "connecting" | "connected" | "error";
  connecting: boolean;
  canConnect: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  isMuted: boolean;
  error: string | null;
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

  // Read live inside long-lived tool closures without re-creating the session.
  const businessName = business?.name ?? "your business";
  const pathnameRef = useRef(pathname);
  const businessNameRef = useRef(businessName);
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);
  useEffect(() => { businessNameRef.current = businessName; }, [businessName]);

  const conversation = useConversation({
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

  return {
    status: conversation.status,
    connecting,
    canConnect,
    isSpeaking: conversation.isSpeaking,
    isListening: conversation.isListening,
    isMuted: conversation.isMuted,
    error,
    connect,
    disconnect,
    toggleMute,
  };
}
