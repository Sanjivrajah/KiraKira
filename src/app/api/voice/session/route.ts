import { NextResponse } from "next/server";
import { z } from "zod";
import { kualaLumpurToday } from "@/components/voice/voice-finance";
import { createLiveVoiceSession, LiveSessionError } from "@/lib/openai/live-session";
import { resolveAuthMode } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { buildVoiceInstructions } from "@/lib/voice/live-instructions";
import { resolveVoiceOwnerName } from "@/lib/voice/owner-name";

export const runtime = "nodejs";

const sessionRequestSchema = z.object({
  sdp: z.string().min(1).max(20_000),
  businessName: z.string().trim().min(1).max(120),
  ownerName: z.string().trim().max(120).optional(),
}).strict();

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function failure(error: string, status: number) {
  return json({ error }, status);
}

/** Resolves the signed-in owner's display name, or `null` when nobody is signed in. */
async function signedInOwnerName(): Promise<{ ownerName: string | undefined } | null> {
  const client = await createSupabaseServerClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) return null;

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("display_name")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profileError) console.warn("Unable to load the voice-session display name.");

  const metadata = auth.user.user_metadata;
  const metadataName = typeof metadata.name === "string" ? metadata.name : undefined;
  const metadataFullName = typeof metadata.full_name === "string" ? metadata.full_name : undefined;
  const name = resolveVoiceOwnerName(profile?.display_name, metadataName, metadataFullName);
  return { ownerName: name === "there" ? undefined : name };
}

/**
 * Exchanges the browser's WebRTC offer for an OpenAI Live SDP answer. The API
 * key stays on the server. In `supabase` auth mode the caller must be signed
 * in; `demo` mode has no server session, matching the app's local-only posture.
 */
export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return failure("The voice assistant is not configured.", 503);
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = sessionRequestSchema.safeParse(body);
  if (!parsed.success) return failure("The voice session request was invalid.", 400);

  let serverOwnerName: string | undefined;
  if (resolveAuthMode() === "supabase") {
    const owner = await signedInOwnerName();
    if (!owner) return failure("Sign in before using the voice assistant.", 401);
    serverOwnerName = owner.ownerName;
  }

  const ownerName = resolveVoiceOwnerName(serverOwnerName, parsed.data.ownerName);
  const instructions = buildVoiceInstructions({
    businessName: parsed.data.businessName,
    ownerName,
    today: kualaLumpurToday(),
  });

  try {
    const session = await createLiveVoiceSession({ sdp: parsed.data.sdp, instructions });
    return json({ sdp: session.sdp, sessionId: session.sessionId, ...(ownerName !== "there" ? { ownerName } : {}) });
  } catch (error) {
    const status = error instanceof LiveSessionError ? error.status : 502;
    // Never surface the provider's message; it can contain account identifiers.
    console.error("OpenAI Live session request failed", { status });
    return status === 429
      ? failure("The voice assistant is busy. Try again in a moment.", 429)
      : failure("The voice assistant is unavailable right now.", 502);
  }
}
