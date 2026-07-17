import { NextResponse } from "next/server";
import { resolveAuthMode } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { resolveVoiceOwnerName } from "@/lib/voice/owner-name";

export const runtime = "nodejs";

const TOKEN_ENDPOINT = "https://api.elevenlabs.io/v1/convai/conversation/token";

function failure(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Mints a short-lived ElevenLabs WebRTC conversation token so the browser can
 * start a live session without ever seeing the API key. In `supabase` auth mode
 * the caller must be signed in; `demo` mode has no server session, so the
 * short-lived token is the only gate (matching the app's local-only posture).
 */
export async function GET() {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  const agentId = process.env.ELEVENLABS_AGENT_ID?.trim();
  if (!apiKey || !agentId) {
    return failure("The voice assistant is not configured.", 503);
  }

  let ownerName: string | undefined;
  if (resolveAuthMode() === "supabase") {
    const client = await createSupabaseServerClient();
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) return failure("Sign in before using the voice assistant.", 401);

    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("display_name")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (profileError) console.warn("Unable to load the voice-session display name.");

    const metadata = auth.user.user_metadata;
    const metadataName = typeof metadata.name === "string" ? metadata.name : undefined;
    const metadataFullName = typeof metadata.full_name === "string" ? metadata.full_name : undefined;
    ownerName = resolveVoiceOwnerName(profile?.display_name, metadataName, metadataFullName);
  }

  let response: Response;
  try {
    response = await fetch(`${TOKEN_ENDPOINT}?agent_id=${encodeURIComponent(agentId)}`, {
      headers: { "xi-api-key": apiKey },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return failure("Could not reach the voice assistant. Try again in a moment.", 502);
  }

  if (!response.ok) {
    // Never surface the provider's raw body; it can contain account identifiers.
    console.error("ElevenLabs token request failed", { status: response.status });
    return failure("The voice assistant is unavailable right now.", response.status === 429 ? 429 : 502);
  }

  const body = (await response.json().catch(() => null)) as { token?: unknown } | null;
  if (!body || typeof body.token !== "string" || body.token.length === 0) {
    return failure("The voice assistant returned an unexpected response.", 502);
  }

  return NextResponse.json(
    { token: body.token, ...(ownerName ? { ownerName } : {}) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
