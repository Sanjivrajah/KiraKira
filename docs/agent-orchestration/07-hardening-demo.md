# Session 7 — hardening and demo guide

## Demo boundary

The Telegram agent is a development demonstration, not production financial
storage, accounting software, or a MyInvois submission client. It accepts only
synthetic demo data in this guide. A model can propose a typed draft; it can
never directly create a confirmed transaction.

## Component and trust boundaries

```text
Telegram update (untrusted)
  -> grammY transport: size/type checks, per-chat provider rate limit
  -> provider boundary: ElevenLabs transcription / OpenAI structured proposal
  -> Zod schemas + deterministic rules: safe draft or safe failure
  -> JSON local store OR authenticated Supabase worker
  -> explicit owner confirmation -> idempotent confirmed transaction

Browser workspace -- link code only --> authenticated Telegram account
```

The worker holds provider credentials and, in Supabase mode, the service-role
credential. Neither is included in browser bundles. Local mode has no
authentication guarantee and must never be described as production storage.
Supabase mode resolves the linked account before reads/writes; RLS protects
member reads of orchestration runs and steps, while worker writes remain on the
server-only service-role path.

## Workflow and responsibilities

```text
received -> extraction -> schema/rule validation -> clarification? -> review
  -> explicit confirm -> duplicate check -> idempotent persistence -> completed
                                  \-> cancel / stale / provider failure (no write)
```

Models only classify/extract bounded proposals. Code enforces input limits,
schema parsing, date and money rules, owner/chat scope, callback shape, state
expiry, duplicate/idempotency keys, deterministic insights, and the confirm
boundary. Unsupported, malformed, expired, repeated, or provider-failed
requests return a recovery message and must not create a financial record.

The database surfaces actually used by Supabase mode are
`telegram_accounts`, `telegram_conversation_states`, `transactions`,
`agent_orchestration_runs`, and `agent_orchestration_steps`. The local demo
uses JSON equivalents under `LOCAL_DATA_DIRECTORY`. An inbound update key is
recorded before provider/draft work; confirm uses a per-draft queue locally and
the `confirm_telegram_transaction` RPC idempotency key in Supabase mode.

## Evaluation fixtures

`src/features/transaction-agent/evaluation-fixtures.ts` contains synthetic
English, Bahasa Melayu, Manglish, typo, multi-action, missing-data, ambiguous
customer, partial-payment, invoice, insight, receipt, voice, replay, and
provider-failure cases. Evaluators assert intent, bounded action count, missing
fields, and a safe state transition—not the model's wording.

## Three-to-five minute demo

1. Seed a dedicated local directory and start the bot:

   ```bash
   npm run demo:agent -- seed --directory ./data/demo-agent
   LOCAL_DATA_DIRECTORY=./data/demo-agent BOT_PERSISTENCE_MODE=local npm run bot:start
   ```

2. In the private demo chat, use `/start`, then send a mixed-language voice
   note: “Hari ini sold nasi lemak RM50 cash, lepas tu beli ayam RM18.” Show the
   reviewable proposal(s), correct a field, and confirm. If voice or a provider
   is unavailable, paste that same sentence as text instead.
3. Use `/summary` and `/insights profit`; explain that figures are estimates
   from recorded transactions, not audited accounts. Use `/agent_trace` only in
   non-production mode to show the redacted run timeline.
4. Use the seeded overdue receivable to show outstanding-payment context, then
   prepare an invoice-readiness draft. State clearly that readiness is a local
   validation boundary, not a MyInvois submission.
5. Press a confirmation button twice to demonstrate duplicate suppression. End
   by showing that no record is saved until the explicit confirmation step.

Reset only the marked synthetic directory after stopping the bot:

```bash
npm run demo:agent -- reset --directory ./data/demo-agent
```

The reset command refuses any directory whose name does not contain `demo` and
requires its own marker file; it never runs against Supabase or browser data.

## Known limitations and next boundary

- Local JSON mode is for a single development process and is not a security
  boundary. The process-local rate limiter is abuse protection, not distributed
  production rate limiting.
- Multi-action confirmation cannot be atomic in the current local file store;
  it prevalidates and reports a partial failure rather than falsely claiming a
  bundle succeeded.
- Receipt extraction supports one JPG, PNG, or WEBP only; PDF, multi-receipt,
  unsupported currency, and unreadable receipt paths fail safely.
- Invoice readiness is not e-Invoice generation or submission. A future
  server-owned MyInvois submission adapter must consume an approved immutable
  invoice snapshot, re-authorize the business member, and retain provider audit
  metadata outside the Telegram model prompt path.

## Verification performed

Run focused fixture, provider-control, orchestration, bot, and schema tests,
then the repository's lint, typecheck, complete test suite, build, and
`git diff --check`. Supabase types remain intentionally behind the pending
orchestration migrations; regenerate only after applying those migrations to a
local Supabase instance.

## Implementation note

### Files changed

- `provider-rate-limit.ts` and its unit test add bounded per-user/chat provider
  protection, wired at Telegram text, voice, and receipt entry points.
- `evaluation-fixtures.ts` and its unit test provide the synthetic evaluation
  contract.
- `scripts/demo-agent.ts`, `package.json`, and this guide provide the seed,
  marker-guarded reset, and documented demo sequence.
- `multi-intent.schema.ts` and its prompt now share the configured three-action
  bound.

### Assumptions and deviations

The current checkout has no safe, complete Supabase demo seed contract for the
new orchestration surfaces, so the provided seed/reset tool intentionally
supports local mode only. It does not touch browser or Supabase records. The
generated database type file also intentionally predates the un-applied
orchestration migrations in this branch; type regeneration is a deployment
environment task after those migrations are applied.
