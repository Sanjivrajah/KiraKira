"use client";

import { MessageSquare, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  deleteStoredVoiceConversation,
  loadStoredVoiceConversations,
  type StoredVoiceConversation,
} from "./voice-conversation-api";

const dateFormatter = new Intl.DateTimeFormat("en-MY", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kuala_Lumpur",
});

interface VoiceConversationHistoryProps {
  businessId: string;
  refreshKey: number;
}

export function VoiceConversationHistory({ businessId, refreshKey }: VoiceConversationHistoryProps) {
  const [conversations, setConversations] = useState<StoredVoiceConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadStoredVoiceConversations(businessId).then(
      (result) => {
        if (!active) return;
        setError(null);
        setConversations(result.conversations);
        setLoading(false);
      },
      () => {
        if (!active) return;
        setError("Saved conversations could not be loaded.");
        setLoading(false);
      },
    );
    return () => { active = false; };
  }, [businessId, refreshKey]);

  async function deleteConversation(conversation: StoredVoiceConversation) {
    const startedAt = dateFormatter.format(new Date(conversation.startedAt));
    if (!window.confirm(`Delete the voice conversation from ${startedAt}? This cannot be undone.`)) return;
    setDeletingId(conversation.id);
    setError(null);
    try {
      await deleteStoredVoiceConversation(conversation.id);
      setConversations((items) => items.filter((item) => item.id !== conversation.id));
    } catch {
      setError("The saved conversation could not be deleted.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="voice-history" aria-labelledby="voice-history-heading">
      <div className="voice-history-heading">
        <div>
          <h2 id="voice-history-heading"><MessageSquare aria-hidden="true" size={18} />Conversation history</h2>
          <p>Private text transcripts are marked for deletion after 90 days. Audio is not stored by NiagaAI.</p>
        </div>
      </div>

      {loading ? <p className="voice-history-state" role="status">Loading saved conversations…</p> : null}
      {error ? <p className="form-alert" role="alert">{error}</p> : null}
      {!loading && !error && conversations.length === 0 ? (
        <p className="voice-history-state">Your completed voice conversations will appear here.</p>
      ) : null}

      <div className="voice-history-list">
        {conversations.map((conversation) => (
          <details className="voice-history-item" key={conversation.id}>
            <summary>
              <span>
                <strong>{dateFormatter.format(new Date(conversation.startedAt))}</strong>
                <small>{conversation.turns.length} {conversation.turns.length === 1 ? "turn" : "turns"}</small>
              </span>
            </summary>
            <div className="voice-history-transcript">
              {conversation.turns.length === 0 ? (
                <p className="voice-history-state">No spoken turns were captured.</p>
              ) : conversation.turns.map((turn) => (
                <p className="voice-history-turn" data-role={turn.role} key={`${conversation.id}-${turn.index}`}>
                  <strong>{turn.role === "user" ? "You" : "Assistant"}</strong>
                  <span>{turn.text}</span>
                </p>
              ))}
              <button
                className="button button-danger voice-history-delete"
                disabled={deletingId === conversation.id}
                onClick={() => void deleteConversation(conversation)}
                type="button"
              >
                <Trash2 aria-hidden="true" size={16} />
                {deletingId === conversation.id ? "Deleting…" : "Delete conversation"}
              </button>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
