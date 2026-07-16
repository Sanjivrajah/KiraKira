# Session 1 — Orchestration Foundation

## Objective

Introduce a small orchestration domain around the existing transaction agent
without changing its user-visible behavior. At the end of this session, current
text, voice, and receipt flows should still behave the same, but pass through a
typed orchestration service that records workflow progress.

## First inspect

Codex should locate and understand:

- Telegram update handlers and callback handlers;
- active conversation state;
- transaction extraction schemas;
- transaction confirmation service;
- local and Supabase repositories;
- existing migration naming and RLS patterns;
- generated database types;
- tests for text, voice, receipt, confirmation, retries, and cross-chat access.

## Work items

### 1. Define orchestration types

Add a minimal set of discriminated unions or Zod schemas for:

- input envelope;
- orchestration run status;
- orchestration step status;
- routed intent;
- proposed action;
- orchestration outcome.

Prefer schemas that infer TypeScript types.

Example conceptual input envelope:

```ts
type AgentInputEnvelope = {
  updateId: string;
  messageId: string;
  telegramUserId: string;
  telegramChatId: string;
  inputKind: "text" | "voice" | "receipt_image" | "callback";
  locale: string;
  normalizedText?: string;
  mediaReference?: string;
  receivedAt: string;
};
```

Adapt identifiers and date representations to existing conventions.

### 2. Introduce an orchestration service

Create a feature-layer service responsible for:

- starting or resuming a run;
- adding step transitions;
- invoking the existing transaction flow through an adapter;
- returning a transport-neutral result;
- mapping failures to safe domain error codes.

Do not move Telegram copy or keyboards into the service.

### 3. Add repository interfaces

Provide interfaces for orchestration run and step persistence.

Implement:

- local persistence compatible with current development mode;
- Supabase persistence only if the current Supabase architecture is ready;
- otherwise create a clear staged adapter and migration in this session.

Any migration must include:

- owner/workspace scoping;
- appropriate foreign keys;
- timestamps;
- indexes for active run lookup and idempotency;
- RLS consistent with current membership policies;
- service-role access only where justified.

### 4. Add idempotency boundary

Use Telegram update/message identifiers and action identifiers to avoid
processing the same inbound update twice.

Decide the actual idempotency key after inspecting existing transaction
confirmation logic. Do not create competing idempotency systems.

### 5. Adapt existing transaction flow

Wrap the existing transaction path as the first specialist capability, likely
named conceptually as `transaction_capture`.

Maintain all current behavior:

- extraction;
- clarification;
- confirmation;
- duplicate warning;
- save-anyway confirmation;
- cancel;
- undo.

### 6. Add redacted structured logging

Log:

- run ID;
- step key;
- status;
- duration;
- safe error code;
- provider name where useful.

Do not log raw transcripts, receipt text, tokens, TINs, customer identifiers, or
complete transaction payloads.

## Tests

Add focused tests for:

- orchestration run creation;
- valid state transitions;
- invalid state transition rejection;
- duplicate update idempotency;
- existing transaction happy path through the adapter;
- provider failure mapping;
- local and Supabase repository behavior where applicable;
- user/chat scoping.

## Done when

- Existing bot tests remain green.
- Current Telegram transaction UX is unchanged.
- Each incoming supported flow has a run ID and traceable steps.
- Duplicate update delivery does not duplicate a draft or confirmed record.
- New domain code has no Telegram SDK dependency.
- Documentation includes an architecture diagram and state transition table.

## Mandatory Codex operating instructions

Before editing any code:

1. Read `AGENTS.md`, then `docs/README.md`, `docs/telegram-agent.md`,
   `docs/architecture.md`, and the relevant feature documentation.
2. Inspect the actual `dev` branch implementation. Do not assume the filenames,
   fields, database tables, or APIs in this plan are exact.
3. Search for existing schemas, types, repositories, tests, migrations,
   localization helpers, keyboards, callbacks, environment parsing, and provider
   wrappers before creating anything new.
4. Reuse existing conventions and extend existing domain types. Do not create a
   parallel architecture merely because this plan uses conceptual names.
5. Treat the existing repository and generated Supabase database types as the
   source of truth. If a field suggested here conflicts with the existing model,
   document the difference and adapt safely.
6. Keep `src/bot/telegram-bot.ts` thin. Put business rules and orchestration logic
   into focused feature/domain modules.
7. Never allow model output to directly perform a confirmed database write.
   Model output must be parsed, schema-validated, deterministically checked, shown
   to the user, and explicitly confirmed when it changes financial data.
8. Preserve local and Supabase persistence modes unless the task explicitly
   replaces them.
9. Add or update tests at the correct seam. Use synthetic data only.
10. Run focused tests while developing, then run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Do not fix unrelated failures silently. Report them separately.

## Implementation decision log

At the end of the session, create or update a short implementation note under
`docs/agent-orchestration/` containing:

- files changed;
- actual schemas/tables/fields used;
- assumptions made;
- deviations from this plan;
- tests run and their results;
- remaining risks or follow-up work.
