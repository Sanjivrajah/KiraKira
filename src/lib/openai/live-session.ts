import "server-only";
import OpenAI from "openai";
import { VOICE_LIVE_TOOLS } from "@/lib/voice/live-tools";

/** Client events the browser may send on the `oai-events` data channel. */
export const VOICE_ALLOWED_CLIENT_EVENTS = [
  "response.item.create",
  "response.create",
  "session.input_audio.mute",
  "session.input_audio.unmute",
  "session.close",
];

const DEFAULT_LIVE_MODEL = "gpt-live-1.1";
const DEFAULT_DELEGATION_MODEL = "gpt-5.6-terra";

/** Carries only the HTTP status out of the SDK so callers never echo provider bodies. */
export class LiveSessionError extends Error {
  constructor(readonly status: number, message = "OpenAI Live session request failed.") {
    super(message);
    this.name = "LiveSessionError";
  }
}

export interface CreateLiveVoiceSessionInput {
  /** The browser's WebRTC SDP offer. */
  sdp: string;
  instructions: string;
}

/**
 * Starts an OpenAI Live session for the browser voice assistant. Tools run
 * through Responses delegation; the browser executes the function calls and
 * returns results over the data channel, which is restricted to the events it
 * needs so a tampered client cannot rewrite the session.
 */
export async function createLiveVoiceSession(
  input: CreateLiveVoiceSessionInput,
): Promise<{ sessionId: string; sdp: string }> {
  const client = new OpenAI({ maxRetries: 0, timeout: 15_000 });
  const model = process.env.OPENAI_LIVE_MODEL?.trim() || DEFAULT_LIVE_MODEL;
  const delegationModel = process.env.OPENAI_LIVE_DELEGATION_MODEL?.trim() || DEFAULT_DELEGATION_MODEL;

  try {
    const result = await client.live.create({
      session: {
        model,
        instructions: input.instructions,
        audio: { output: { voice: "marin" } },
        store: false,
        delegation: {
          type: "responses",
          responses: {
            model: delegationModel,
            // The delegated model is the one that calls the bookkeeping tools, so it
            // needs the confirm-before-save rules and today's date too; Live
            // instructions alone do not reach it.
            instructions: input.instructions,
            tools: [...VOICE_LIVE_TOOLS],
            tool_choice: "auto",
            parallel_tool_calls: true,
          },
        },
        client: { data_channel: { allowed_client_events: VOICE_ALLOWED_CLIENT_EVENTS } },
      },
      transport: { type: "webrtc", sdp: input.sdp },
    });
    return { sessionId: result.session.id, sdp: result.transport.sdp };
  } catch (error) {
    if (error instanceof OpenAI.APIError) throw new LiveSessionError(error.status ?? 502);
    throw new LiveSessionError(502);
  }
}
