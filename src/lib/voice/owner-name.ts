/**
 * Select a human-provided display name for the voice agent.
 *
 * Email local-parts are deliberately not accepted as a fallback: addresses are
 * identifiers, not reliable names, and may expose an internal handle aloud.
 */
export function resolveVoiceOwnerName(...candidates: Array<string | null | undefined>) {
  for (const candidate of candidates) {
    const name = candidate?.trim();
    if (name) return name;
  }
  return "there";
}
