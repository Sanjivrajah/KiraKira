# Session 7 — Hardening, Evaluation, and Hackathon Demo

## Objective

Prepare the orchestration system for a reliable end-to-end demonstration and
document its limitations honestly.

## Work items

### 1. Build an evaluation fixture set

Create synthetic examples for:

- English;
- Bahasa Melayu;
- Manglish;
- spelling mistakes;
- multiple transactions;
- missing fields;
- ambiguous customer;
- partial payment;
- invoice readiness;
- insight query;
- receipt image;
- voice transcript;
- duplicate/replayed update;
- provider failure.

Expected outputs should validate intent, action count, required fields, and safe
state transitions, not exact model prose.

### 2. Add safety and abuse controls

Confirm:

- message and media size limits;
- bounded action count;
- rate limiting for provider-heavy endpoints;
- prompt-injection-resistant system instructions;
- schema validation;
- safe filenames and temporary cleanup;
- no secrets in client bundles or logs;
- ownership checks at every read/write;
- callback authenticity/state checks;
- RLS tests where supported.

### 3. Add graceful degradation

Demonstrate safe behavior when:

- ElevenLabs is unavailable;
- extraction provider times out;
- Supabase is unavailable;
- a callback is repeated;
- one action in a bundle is invalid;
- conversation state expires;
- receipt image is unsupported;
- model returns malformed JSON.

The user should receive a recovery action and no accidental write.

### 4. Create demo seed and reset tooling

Use synthetic Malaysian microbusiness data only.

Provide a documented command to:

- seed one demo owner/business;
- seed customers and confirmed transactions;
- seed one overdue receivable;
- clear only demo data safely;
- avoid touching production data.

### 5. Create demo script

Document a 3–5 minute sequence:

1. Link Telegram to the demo workspace.
2. Send a mixed-language voice note with sale, expense, and receivable.
3. Show multiple routed actions.
4. Correct one field.
5. Confirm the bundle.
6. Show dashboard update.
7. Ask for outstanding payments or profit.
8. Prepare an invoice-readiness draft.
9. Show the orchestration trace and validation boundary.

Include fallback text-input steps if voice or external providers fail.

### 6. Add architecture documentation

Document:

- component diagram;
- sequence diagram;
- workflow state machine;
- trust boundaries;
- model vs deterministic responsibilities;
- database tables actually used;
- idempotency strategy;
- confirmation boundary;
- known limitations;
- future MyInvois submission boundary.

### 7. Final verification

Run all repository checks and execute the demo from a clean state.

Also verify:

- local mode;
- Supabase mode;
- private Telegram chat;
- repeated callback;
- narrow/mobile dashboard view if any UI changed;
- no raw sensitive content in logs;
- generated database types are current.

## Done when

- The full demo can be repeated from documented steps.
- Every financial write is reviewable and idempotent.
- Failure scenarios do not produce unintended records.
- Architecture and limitations are clear enough for judges and future
  contributors.
- No demo-only bypass weakens production paths.

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
