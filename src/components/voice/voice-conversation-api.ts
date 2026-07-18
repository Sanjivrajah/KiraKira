import type { TranscriptTurn } from "./voice-transcript";

const ENDPOINT = "/api/voice/conversations";

async function jsonRequest(method: string, body: object) {
  const response = await fetch(ENDPOINT, {
    method,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("Voice conversation persistence request failed.");
  return response.json() as Promise<Record<string, unknown>>;
}

export async function startStoredVoiceConversation(businessId: string, providerConversationId: string) {
  const result = await jsonRequest("POST", { businessId, providerConversationId });
  return typeof result.conversationId === "string" ? result.conversationId : null;
}

export async function saveStoredVoiceTurn(conversationId: string, turn: TranscriptTurn) {
  await jsonRequest("PUT", {
    conversationId,
    turnIndex: turn.id,
    role: turn.role,
    content: turn.text,
  });
}

export async function finishStoredVoiceConversation(conversationId: string, status: "completed" | "failed") {
  await jsonRequest("PATCH", { conversationId, status });
}

export async function deleteStoredVoiceConversation(conversationId: string) {
  await jsonRequest("DELETE", { conversationId });
}

export interface StoredVoiceConversation {
  id: string;
  status: "active" | "completed" | "failed";
  startedAt: string;
  endedAt: string | null;
  retentionDeleteAfter: string;
  turns: Array<{
    index: number;
    role: "user" | "assistant";
    text: string;
    createdAt: string;
  }>;
}

export async function loadStoredVoiceConversations(businessId: string) {
  const response = await fetch(`${ENDPOINT}?businessId=${encodeURIComponent(businessId)}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Voice conversation history request failed.");
  return response.json() as Promise<{ enabled: boolean; conversations: StoredVoiceConversation[] }>;
}
