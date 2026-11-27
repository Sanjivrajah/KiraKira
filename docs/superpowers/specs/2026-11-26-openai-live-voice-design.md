# OpenAI Live voice agent for `/voice` — design

## Intent

The owner wants to try OpenAI's Live API (`POST /v1/live/sessions`) and has decided it
replaces ElevenLabs as the `/voice` conversational agent. The existing bookkeeping
behaviour (stage drafts → read back → explicit confirm) must keep working.

## Goals

- `/voice` runs on `gpt-live-1.1` over WebRTC; no ElevenLabs code on that path.
- All existing voice tools in `src/components/voice/client-tools.ts` keep working.
- The voice UI (panel, orb, captions, draft review, history) is unchanged.
- The OpenAI API key never reaches the browser.

## Non-goals

- ElevenLabs speech-to-text (`/api/audio/transcribe`, Telegram bot) stays as is.
- No new UI design, no SIP/telephony, no session forking or recording (`store: false`).

## Constraints

- Live API facts used: WebRTC SDP offer is POSTed server-side with the API key; response
  carries `transport.sdp` answer and `session.id`. Data channel label `oai-events`.
  Do not send `session.start`; wait for `session.started`. Close with `session.close`
  and wait for `session.closed`. Transcripts arrive as `session.input_transcript.delta`
  / `session.output_transcript.delta`. Mute via `session.input_audio.mute|unmute`.
- Tools: `session.delegation = { type: "responses", responses: { model, instructions, tools } }`.
  Calls arrive as `response.event` wrapping `response.output_item.done` with a
  `function_call` item (`call_id`, `name`, `arguments`). Results go back as
  `response.item.create` (`function_call_output`) for every pending call, then one
  `response.create`.
- Browser-side execution of delegated function calls is inferred from the event flow,
  not explicitly documented. If it fails in practice, report it rather than work around
  it silently.
- AGENTS.md rules: auth in the route handler, Zod validation, safe errors, no logging of
  transcripts or provider bodies.

## Approaches

- **Responses delegation with browser-executed function tools (chosen).** Reuses the
  existing tool handlers unchanged; only transport and tool declaration change.
- Client delegation: rejected — the app receives free-form requests and would need its
  own LLM layer to map them onto tools.
- Side-by-side `/voice/openai` page: rejected by the owner; replace outright.

## Design

1. `POST /api/voice/session` (Node runtime): auth as today (Supabase mode requires a user),
   validates `{ sdp, businessName?, today? }`, builds instructions (system prompt with
   business name, owner name, today, MYR), declares the tool list, calls
   `client.live.create` (openai v7, `maxRetries: 0`), returns `{ sdp, sessionId, ownerName? }`.
2. Tool definitions move from `docs/reference/elevenlabs-tools.json` into a typed module
   of Responses function definitions; a test asserts names match the handler map exactly.
3. A small browser Live client (RTCPeerConnection, mic track, remote audio element,
   `oai-events` channel, mute, graceful close with timeout) and a rewritten
   `use-voice-agent.ts` that keeps the `UseVoiceAgentResult` contract. Speaking state is
   derived from output transcript deltas / audio activity.
4. Remove `@elevenlabs/react`, `ELEVENLABS_AGENT_ID`, and the ElevenLabs agent doc; bump
   `openai` to v7; update `docs/voice-agent.md`, configuration and HTTP API docs.

## Left to the builder

- Exact delegation model (default to an env var `OPENAI_LIVE_DELEGATION_MODEL` with a
  sensible default) and voice (`marin`).
- How transcript deltas are grouped into turns for history persistence.
