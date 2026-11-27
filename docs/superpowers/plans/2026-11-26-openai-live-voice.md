# OpenAI Live voice agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ElevenLabs conversational agent behind `/voice` with OpenAI's Live API (`gpt-live-1.1` over WebRTC) while keeping every voice tool and the existing voice UI.

**Architecture:** The browser creates a WebRTC offer; `POST /api/voice/session` forwards it with the server-held API key to `client.live.create` (session instructions + function tools under `responses` delegation) and returns the SDP answer. A small browser client owns the peer connection and the `oai-events` data channel; pure protocol helpers translate server events; `use-voice-agent.ts` keeps its public `UseVoiceAgentResult` contract and runs the existing `createVoiceClientTools` handlers for delegated function calls.

**Tech Stack:** Next.js 16 App Router route handler, `openai` ^7.65.0 (`client.live`, types from `openai/resources/live/live`), browser WebRTC + Web Audio, Zod 4, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-26-openai-live-voice-design.md`

## Global Constraints

- Node 22 is required (`openai` v7 `engines: >=22`, project `engines: 22.x`). The local shell currently runs Node 18.15 — switch before running anything.
- Live model `OPENAI_LIVE_MODEL` default `gpt-live-1.1`; delegation model `OPENAI_LIVE_DELEGATION_MODEL` default `gpt-5.6-terra`; voice `marin`; `store: false`.
- WebRTC: data channel label `oai-events`; never send `session.start`; never set `audio.format`.
- Tool results: one `response.item.create` (`function_call_output`) per pending call, then exactly one `response.create`.
- Browser may only send: `response.item.create`, `response.create`, `session.input_audio.mute`, `session.input_audio.unmute`, `session.close` (`session.client.data_channel.allowed_client_events`).
- `OPENAI_API_KEY` never leaves the server; the session module imports `server-only`.
- Never log transcripts, tool arguments, SDP, or raw provider bodies. User-facing errors are fixed copy.
- ElevenLabs speech-to-text (`src/lib/elevenlabs`, `/api/audio/transcribe`, Telegram bot, `ELEVENLABS_API_KEY`) is out of scope and stays.

## Review Focus

- Model emits a function call with malformed JSON `arguments` or an unknown tool name → the session continues; the model receives a short spoken-friendly error string as the output (Task 5).
- Two function calls in one delegated response → both handlers run, two `response.item.create` events, one `response.create` (Task 5).
- User clicks Stop while a tool is still running, or the tab closes → mic track stopped, peer connection closed, no result sent on a closed channel, no unhandled rejection (Task 6).
- Mic permission denied or ICE gathering never completes → error phase with recovery copy, no half-open peer connection (Task 6).
- Business name containing quotes/newlines or 500 characters → request still valid up to 120 chars, rejected with 400 beyond; prompt text not broken (Task 3).

---

### Task 1: Upgrade `openai` to v7 and add Live env defaults

**Files:**
- Modify: `package.json`, `package-lock.json`, `.env.example`
- Modify (only if typecheck fails): `src/lib/openai/*.ts`

**Interfaces:**
- Produces: `openai@^7.65.0` installed; `.env.example` has `OPENAI_LIVE_MODEL=gpt-live-1.1` and `OPENAI_LIVE_DELEGATION_MODEL=gpt-5.6-terra`; `ELEVENLABS_AGENT_ID` removed.

- [ ] **Step 1:** `node -v` prints `v22.*` (switch via nvm/volta if not).
- [ ] **Step 2:** `npm install openai@^7.65.0`.
- [ ] **Step 3:** `npm run typecheck && npx vitest run src/lib/openai` → PASS. Fix only v6→v7 breakages in existing extraction modules.
- [ ] **Step 4:** Update `.env.example` as above.
- [ ] **Step 5:** Commit `chore(deps): upgrade openai to v7 for the Live API`.

### Task 2: Function tool definitions for the Live session

**Files:**
- Create: `src/lib/voice/live-tools.ts`, `src/lib/voice/live-tools.test.ts`
- Delete: `docs/reference/elevenlabs-tools.json`, `src/components/voice/elevenlabs-tools.test.ts`

**Interfaces:**
- Produces: `export const VOICE_LIVE_TOOLS: readonly FunctionTool[]` (`FunctionTool` from `openai/resources/live/live`).

- [ ] **Step 1: Write the failing test** `live-tools.test.ts` (reuse the `noopController`/`deps` fixture from `elevenlabs-tools.test.ts`):
  - `it("declares exactly the tools exposed by createVoiceClientTools")` — sorted `VOICE_LIVE_TOOLS.map(t => t.name)` equals sorted `Object.keys(createVoiceClientTools(deps))` (36 names).
  - `it("has no duplicate names")`.
  - `it("uses an object JSON schema for every tool")` — each: `type === "function"`, non-empty `description`, `parameters.type === "object"`, `parameters.additionalProperties === false`, every `required` entry is a key of `parameters.properties`, each property `type` ∈ `string | number | boolean`.
- [ ] **Step 2:** `npx vitest run src/lib/voice/live-tools.test.ts` → FAIL (module missing).
- [ ] **Step 3:** Generate the module once from `docs/reference/elevenlabs-tools.json` with a throwaway script (not committed): each entry → `{ type: "function", name, description, parameters: { type: "object", properties: { [id]: { type, description } }, required: ids where required, additionalProperties: false } }`. Emit as a typed TS literal with `as const satisfies readonly FunctionTool[]`. Do not set `strict` (optional params are allowed to be absent).
- [ ] **Step 4:** Run the test → PASS. Delete the JSON and the old test.
- [ ] **Step 5:** Commit `feat(voice): declare voice tools as Live function tools`.

### Task 3: Session instructions and `POST /api/voice/session`

**Files:**
- Create: `src/lib/voice/live-instructions.ts`, `src/lib/voice/live-instructions.test.ts`, `src/lib/openai/live-session.ts`
- Modify: `src/app/api/voice/session/route.ts`, `src/app/api/voice/session/route.test.ts`

**Interfaces:**
- Consumes: `VOICE_LIVE_TOOLS` (Task 2); `resolveVoiceOwnerName` (`src/lib/voice/owner-name.ts`); `kualaLumpurToday` (`src/components/voice/voice-finance.ts`, pure).
- Produces:
  - `buildVoiceInstructions(input: { businessName: string; ownerName: string; today: string }): string`
  - `createLiveVoiceSession(input: { sdp: string; instructions: string }): Promise<{ sessionId: string; sdp: string }>` (throws `LiveSessionError` with `status: number`)
  - `POST /api/voice/session` body `{ sdp: string; businessName: string; ownerName?: string }` → `200 { sdp: string; sessionId: string; ownerName?: string }`; errors `{ error: string }` with 400 / 401 / 429 / 502 / 503. `GET` is removed.

- [ ] **Step 1: Write failing tests.**
  - `live-instructions.test.ts`: output contains `Kedai Ali`, `Siti`, `2026-11-26`, `MYR`; contains no `{{`; the first-message greeting line names owner and business; a business name with `"` and `\n` is embedded on a single line (newlines collapsed to spaces).
  - `route.test.ts` (mock `@/lib/openai/live-session` and Supabase as today):
    - returns `{ sdp: "answer", sessionId: "live_123", ownerName: "Sanjivrajah" }` and passes instructions containing the business name to `createLiveVoiceSession`.
    - 503 `"The voice assistant is not configured."` when `OPENAI_API_KEY` unset.
    - 401 when Supabase has no user.
    - 400 for missing `sdp`, empty `businessName`, and a 121-char `businessName`.
    - 502 when `createLiveVoiceSession` throws; 429 when it throws with `status: 429`; response body never contains the thrown message.
- [ ] **Step 2:** Run both → FAIL.
- [ ] **Step 3:** Implement `buildVoiceInstructions` with the "System prompt" and "First message" text from `docs/voice-agent.md`, placeholders filled; add a closing line "Start the conversation by greeting the owner with the first message." Sanitize inputs with `value.replace(/\s+/g, " ").trim()`.
- [ ] **Step 4:** Implement `createLiveVoiceSession` (`import "server-only"`; `new OpenAI({ maxRetries: 0, timeout: 15_000 })`; `client.live.create`) with session `{ model, instructions, audio: { output: { voice: "marin" } }, store: false, delegation: { type: "responses", responses: { model: delegationModel, tools: [...VOICE_LIVE_TOOLS], tool_choice: "auto", parallel_tool_calls: true } }, client: { data_channel: { allowed_client_events: [the five events] } } }` and `transport: { type: "webrtc", sdp }`. Map `OpenAI.APIError` to `LiveSessionError(status)`; log only `{ status }`.
- [ ] **Step 5:** Rewrite the route as `POST` with a strict Zod schema (`sdp` 1–20 000 chars, `businessName` trimmed 1–120, `ownerName` optional trimmed ≤120). Keep the existing Supabase auth + profile-name lookup; prefer the server-resolved name, fall back to body `ownerName`, then `"there"`. `Cache-Control: no-store` on every response.
- [ ] **Step 6:** Run tests → PASS.
- [ ] **Step 7:** Commit `feat(voice): create OpenAI Live sessions from the voice session route`.

### Task 4: Transcript deltas

**Files:**
- Modify: `src/components/voice/voice-transcript.ts`, `src/components/voice/voice-transcript.test.ts`

**Interfaces:**
- Produces: `appendTranscriptDelta(turns: readonly TranscriptTurn[], role: TranscriptTurn["role"], delta: string): TranscriptTurn[]`. `TranscriptMessage` and `appendTranscriptTurn` are removed.

- [ ] **Step 1: Failing tests:** `"Hel"` + `"lo"` same role → one turn `"Hello"` (raw concatenation, no inserted space); role switch → new turn with `id = last.id + 1`; whitespace-only delta on an empty list → unchanged reference; leading whitespace of a new turn trimmed; 31 alternating turns → length `MAX_TRANSCRIPT_TURNS` (30) keeping the newest; Unicode delta (`"semalam 😀"`) preserved.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `refactor(voice): build captions from streamed transcript deltas`.

### Task 5: Live event protocol and tool dispatch (pure)

**Files:**
- Create: `src/components/voice/live-protocol.ts`, `src/components/voice/live-protocol.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type LiveVoiceEvent =
    | { kind: "started"; sessionId: string }
    | { kind: "transcript"; role: "user" | "assistant"; delta: string }
    | { kind: "function_call"; groupId: string; callId: string; name: string; arguments: string }
    | { kind: "response_done"; groupId: string }
    | { kind: "closed"; reason: string | null }
    | { kind: "error"; fatal: boolean };
  export function parseLiveServerEvent(raw: string): LiveVoiceEvent | null;
  export function runToolCalls(calls: readonly { callId: string; name: string; arguments: string }[], tools: Record<string, (p: Record<string, unknown>) => Promise<string> | string>): Promise<{ callId: string; output: string }[]>;
  export function toolResultEvents(results: readonly { callId: string; output: string }[]): ClientEvent[];
  ```
- Mapping: `session.started`→started; `session.input_transcript.delta`→user transcript; `session.output_transcript.delta`→assistant; `response.event` whose `event.type === "response.output_item.done"` and `event.item.type === "function_call"`→function_call with `groupId = delegation_id ?? "default"`; `response.event` with `event.type` ∈ `response.completed | response.failed | response.incomplete`→response_done; `session.closed`→closed (`reason`); `error`→error, `fatal: false` when `error.code === "responses_validation_failed"`, else `true`. Anything else (including non-JSON) → `null`.

- [ ] **Step 1: Failing tests** with minimal JSON fixtures for every mapping above, plus: non-JSON → `null`; `runToolCalls` with invalid JSON arguments → output `"I couldn't read those details. Please say that again."` and the tool is not invoked; unknown name → `"That action isn't available."`; a throwing tool → `"Something went wrong with that action. Please try again."`; two calls → two results in input order; `toolResultEvents` of two results → `[item.create, item.create, response.create]` with `item: { type: "function_call_output", call_id, output }`; empty results → `[]`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement (Zod `safeParse` per event shape; `JSON.parse` in try/catch; non-object JSON args count as invalid). **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(voice): parse Live events and dispatch delegated tool calls`.

### Task 6: Browser WebRTC client

**Files:**
- Create: `src/components/voice/live-client.ts`, `src/components/voice/live-client.test.ts`

**Interfaces:**
- Consumes: `parseLiveServerEvent`, `LiveVoiceEvent` (Task 5).
- Produces:
  ```ts
  export interface LiveVoiceConnection {
    sessionId: string;
    send(event: ClientEvent): void;            // no-op unless channel is open
    setMuted(muted: boolean): void;            // track.enabled + mute/unmute event
    getInputVolume(): number;                  // 0–1 RMS from an AnalyserNode
    getOutputVolume(): number;
    close(): Promise<void>;                    // idempotent
  }
  export function connectLiveVoice(options: {
    requestAnswer(offerSdp: string): Promise<{ sdp: string; sessionId: string }>;
    onEvent(event: LiveVoiceEvent): void;
    onConnectionLost(): void;
    media?: { getUserMedia: typeof navigator.mediaDevices.getUserMedia; createPeerConnection: () => RTCPeerConnection };
  }): Promise<LiveVoiceConnection>;
  ```
- Behaviour: getUserMedia(audio) → add tracks → `createDataChannel("oai-events")` with message listener → offer → wait for `iceGatheringState === "complete"` (10 s timeout) → `requestAnswer(localDescription.sdp)` → `setRemoteDescription({ type: "answer", sdp })`. Remote audio via a detached `Audio` element with `autoplay`. `close()`: send `session.close`, wait for a `closed` event or 5 s, then stop tracks, close channel/peer, close the `AudioContext`, clear `srcObject`. `connectionstatechange` to `failed`/`disconnected` (after open) → `onConnectionLost()`. Any failure during connect cleans up everything before rethrowing.

- [ ] **Step 1: Failing tests** with injected fakes (`media` option, fake `RTCPeerConnection` and data channel): creates channel labelled `oai-events`; sends offer SDP to `requestAnswer` and applies the answer; forwards parsed events to `onEvent`; `setMuted(true)` disables the track and sends `session.input_audio.mute`; `close()` sends `session.close`, stops tracks and closes the peer, and a second `close()` is a no-op; `requestAnswer` rejecting → tracks stopped, peer closed, promise rejects.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement (guard `AudioContext` absence in jsdom: volumes return 0). **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat(voice): add a WebRTC client for OpenAI Live sessions`.

### Task 7: Rewire `useVoiceAgent` and remove `@elevenlabs/react`

**Files:**
- Modify: `src/components/voice/use-voice-agent.ts`, `src/components/voice/voice-agent-provider.tsx`, `src/components/voice/client-tools.ts` (comments only: "ElevenLabs" → "the Live model"), `package.json`, `package-lock.json`
- Modify tests that mock `@elevenlabs/react`: `voice-agent-panel.test.tsx`, `voice-agent-launcher.test.tsx`, `voice-interface.test.tsx` (mock `./live-client` instead)

**Interfaces:**
- Consumes: Tasks 3–6. `UseVoiceAgentResult` stays byte-for-byte the same.

- [ ] **Step 1: Failing test** `use-voice-agent.test.tsx` (mock `./live-client`, `fetch`, services): `connect()` posts `{ sdp, businessName, ownerName }` to `/api/voice/session`; transcript events produce captions; a `function_call` + `response_done` for `create_transaction_draft` stages a draft in `useVoiceDraftStore` and calls `send` with two events (item + `response.create`); 401 → error `"Sign in again to use the voice assistant."`; `disconnect()` calls `close()` once even when invoked twice.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement: own `status` state; keep tool deps wiring unchanged; queue `function_call`s per `groupId` and on `response_done` run `runToolCalls` then `connection.send(...toolResultEvents(results))` (skip if the session ended meanwhile). `isSpeaking` is true on an assistant delta and clears 700 ms after the last one; `awaitingReply` set on user delta, cleared on assistant delta. Persist a caption turn when the speaker switches and flush the final turn before `finishTranscriptStorage`. Start stored conversation on `started` with `sessionId` as `providerConversationId`. Replace the ElevenLabs-specific error copy with `"The assistant ended the session. Please start again."`. Provider drops `ConversationProvider`. `npm uninstall @elevenlabs/react`.
- [ ] **Step 4:** `npx vitest run src/components/voice` → PASS; `grep -rn "elevenlabs/react" src` → no matches.
- [ ] **Step 5:** Commit `feat(voice): run the voice assistant on OpenAI Live`.

### Task 8: Docs and full verification

**Files:**
- Modify: `docs/voice-agent.md` (retitle "OpenAI Live voice agent"; prompt now lives in `src/lib/voice/live-instructions.ts`, tools in `src/lib/voice/live-tools.ts`), `docs/README.md`, `docs/configuration.md`, `docs/getting-started.md`, `docs/web-application.md`, `docs/http-api.md`

- [ ] **Step 1:** Update docs; `grep -rn "ELEVENLABS_AGENT_ID\|elevenlabs-tools" docs src .env.example` → no matches.
- [ ] **Step 2:** `npm run lint && npm run typecheck && npm test && npm run build` → all pass, no warnings.
- [ ] **Step 3:** Manual browser check on `npm run dev` with a real key: start a session, say a sale, hear the read-back, confirm, see it in transactions; mute/unmute; stop; at 375 px, 768 px, 1280 px; console free of errors. If delegated function calls never arrive in the browser, stop and report.
- [ ] **Step 4:** Commit `docs(voice): document the OpenAI Live voice agent`.
