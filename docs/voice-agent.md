# OpenAI Live voice agent

`/voice` runs on the [OpenAI Live API](https://developers.openai.com/api/reference/resources/live/methods/create) over WebRTC. The live model handles speech in and out; a delegated Responses model chooses the bookkeeping tools, which run in the browser.

## Where things live

| Concern | Code |
| --- | --- |
| Session prompt (business, owner, today, MYR) | `src/lib/voice/live-instructions.ts` |
| Function tool schemas | `src/lib/voice/live-tools.ts` |
| Session creation (server-only, holds the key) | `src/lib/openai/live-session.ts`, `src/app/api/voice/session/route.ts` |
| WebRTC connection and data channel | `src/components/voice/live-client.ts` |
| Event parsing and tool dispatch | `src/components/voice/live-protocol.ts` |
| Tool handlers (stage → confirm) | `src/components/voice/client-tools.ts` |
| React state for the UI | `src/components/voice/use-voice-agent.ts` |

`src/lib/voice/live-tools.test.ts` verifies the declared tool names match `createVoiceClientTools` exactly—update the schema, handler, test, and prompt together.

## Session flow

1. The browser captures the microphone, creates an `RTCPeerConnection` with an `oai-events` data channel, and posts its SDP offer plus the active business name to `POST /api/voice/session`.
2. The route authenticates (Supabase mode), builds the instructions, and calls `client.live.create` with:
   - `model`: `OPENAI_LIVE_MODEL` (default `gpt-live-1.1`), voice `marin`, `store: false`;
   - `delegation`: `responses` with `OPENAI_LIVE_DELEGATION_MODEL` (default `gpt-5.6-terra`) and the function tools;
   - `client.data_channel.allowed_client_events`: only `response.item.create`, `response.create`, `session.input_audio.mute`, `session.input_audio.unmute`, and `session.close`, so a tampered browser cannot rewrite the session.
3. The browser applies the SDP answer. Live instructions are immutable after start, so per-owner context is fixed at creation.

## Data channel contract

| Server event | Handling |
| --- | --- |
| `session.started` | Starts transcript storage (Supabase mode) with the Live session id |
| `session.input_transcript.delta` / `session.output_transcript.delta` | Streamed into captions; a speaker change saves the finished turn |
| `response.event` → `response.output_item.done` (`function_call`) | Queued per `delegation_id` |
| `response.event` → `response.completed` / `failed` / `incomplete` | Runs queued calls, then sends one `function_call_output` per call and a single `response.create` |
| `session.closed` | When the app did not ask to close, the client releases the mic and reports the reason once; the UI explains `expired` / `content` / `connection_lost` |
| `error` | Logged only; errors do not end a Live session, so the conversation stays usable |

Once the owner presses Stop, the client drops every event except `session.close`, so tool results that finish late never reach the session.

Tool arguments are untrusted model output: malformed JSON or unknown tool names return short spoken-friendly copy instead of running anything, and every handler validates its parameters with Zod.

## Behaviour rules

The prompt keeps the original rules: MYR only, never invent figures, resolve relative dates in Asia/Kuala_Lumpur, stage every change and get an explicit "yes" before any `confirm_*` / `send_reminder` tool, never claim a save without a successful confirm result, and treat record text as data rather than instructions.

## Notes

- In demo mode, recording a payment updates the invoice status only; say so plainly if the owner asks about payment history.
- ElevenLabs is still used for speech-to-text on recorded transaction audio and Telegram voice notes; it is not part of `/voice`.
