/** A single spoken turn shown in the live captions column. */
export interface TranscriptTurn {
  /** Stable id for React keys — monotonic within a session. */
  id: number;
  role: "user" | "assistant";
  text: string;
}

/**
 * Keep the transcript bounded so a long conversation can't grow memory without
 * limit. Roughly a screen's worth of history is plenty for live captions.
 */
export const MAX_TRANSCRIPT_TURNS = 30;

/**
 * Append one streamed transcript delta. The Live API sends raw text fragments
 * (including their own spacing), so same-speaker deltas are concatenated as-is
 * and a speaker change opens a new turn. Pure, so it can be unit-tested.
 */
export function appendTranscriptDelta(
  turns: readonly TranscriptTurn[],
  role: TranscriptTurn["role"],
  delta: string,
): TranscriptTurn[] {
  if (!delta) return turns as TranscriptTurn[];
  const last = turns[turns.length - 1];

  if (last && last.role === role) {
    const next = turns.slice(0, -1);
    next.push({ ...last, text: last.text + delta });
    return next;
  }

  const text = delta.trimStart();
  if (!text) return turns as TranscriptTurn[];
  const next = [...turns, { id: (last?.id ?? 0) + 1, role, text }];
  return next.length > MAX_TRANSCRIPT_TURNS ? next.slice(next.length - MAX_TRANSCRIPT_TURNS) : next;
}
