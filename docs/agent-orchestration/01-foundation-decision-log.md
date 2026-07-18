# Agent orchestration foundation — implementation decision log

## Scope delivered

The Telegram transaction agent now records a redacted orchestration run and a
`transaction_capture` step around text, voice, receipt-draft, confirmation,
cancel/save-anyway, and undo execution. Telegram copy, keyboards, draft
schemas, clarification rules, confirmation rules, and the explicit owner
approval boundary are unchanged.

## Actual architecture

```text
Telegram update
  -> src/bot/telegram-bot.ts (normalizes only IDs, kind, locale, safe metadata)
  -> TransactionOrchestrationService
       -> run + transaction_capture step (redacted trace, idempotency boundary)
       -> existing TransactionInputProcessor or TransactionDraftService
       -> existing draft/review/confirmation workflow
  -> Telegram presentation and keyboards
```

| From | Allowed next states | Used in Session 1 |
| --- | --- | --- |
| `routing` | `awaiting_clarification`, `awaiting_confirmation`, `executing`, `completed`, `cancelled`, `failed` | `completed`, `failed` |
| `awaiting_clarification` | `routing`, `cancelled`, `failed` | Reserved for the next workflow session |
| `awaiting_confirmation` | `executing`, `cancelled`, `failed` | Reserved for the next workflow session |
| `executing` | `completed`, `failed` | Reserved for controlled action execution |
| terminal states | none | Enforced by `assertOrchestrationTransition` |

## Files and persistence

- `src/features/transaction-agent/orchestration.schema.ts` defines Zod-inferred
  input, run, step, intent, action, outcome, and safe-error types.
- `src/features/transaction-agent/orchestration-service.ts` owns idempotency,
  transition checks, adapter invocation, and structured redacted logging.
- `src/features/transaction-agent/orchestration-repository.ts` provides local
  JSON persistence in `agent-orchestration.json` and the Supabase worker adapter.
- `supabase/migrations/20260716170000_agent_orchestration_foundation.sql` adds
  `agent_orchestration_runs` and `agent_orchestration_steps`. Both are scoped by
  `telegram_account_id`; that existing record is already linked to the active
  business member. Runs are uniquely idempotent by `idempotency_key`; the active
  lookup index is `(telegram_account_id, updated_at desc)`.

Stored `input_summary` contains only character count plus media/action flags.
It never stores raw transcript, receipt text, model output, financial payload,
customer data, TIN, or provider token.

## Deviations and assumptions

- The existing `idempotency_keys` table continues to protect confirmed
  Supabase transaction writes. The new run key prevents duplicate inbound
  updates before draft creation; it does not replace confirmation idempotency.
- Supabase generated types are already behind current Telegram migrations in
  this branch, so the Supabase orchestration adapter follows the existing narrow
  worker-adapter convention. Regenerate `src/lib/supabase/database.types.ts`
  after applying this migration before removing that temporary boundary.
- Session 1 has one routed intent, `transaction_capture`; it deliberately does
  not introduce unsupported multi-intent actions or change the current draft
  state machine.
- Receipt extraction remains in its current provider boundary; its draft
  persistence/review phase is traced. Provider calls themselves are not logged
  with raw evidence.

## Verification

- `npm run lint` — passed.
- `npm run typecheck` — passed.
- Focused orchestration, bot, transaction-input, conversation-flow, and schema
  migration tests — 42 passed.

## Remaining follow-up

- Apply the migration in a Supabase environment, regenerate database types,
  and add Supabase integration tests for run/step RLS and worker replay.
- Later sessions should use the reserved awaiting/executing states when they
  add workflow routing and explicit proposed-action records.
