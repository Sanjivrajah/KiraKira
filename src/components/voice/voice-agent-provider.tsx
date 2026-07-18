"use client";

import { ConversationProvider } from "@elevenlabs/react";
import { createContext, useContext, type ReactNode } from "react";
import { useVoiceAgent, type UseVoiceAgentResult } from "./use-voice-agent";

const VoiceAgentContext = createContext<UseVoiceAgentResult | null>(null);

function VoiceAgentSession({ children }: { children: ReactNode }) {
  const agent = useVoiceAgent();
  return <VoiceAgentContext.Provider value={agent}>{children}</VoiceAgentContext.Provider>;
}

/** Keeps one voice connection alive while users move between workspace routes. */
export function VoiceAgentProvider({ children }: { children: ReactNode }) {
  return <ConversationProvider><VoiceAgentSession>{children}</VoiceAgentSession></ConversationProvider>;
}

export function usePersistentVoiceAgent() {
  const agent = useContext(VoiceAgentContext);
  if (!agent) throw new Error("usePersistentVoiceAgent must be used within VoiceAgentProvider.");
  return agent;
}
