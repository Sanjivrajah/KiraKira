# NiagaAI Agent Orchestration — Master Plan

## Goal

Evolve the existing Telegram transaction assistant into a controlled,
observable multi-workflow agent system without discarding the transaction
capture, voice transcription, receipt extraction, confirmation, duplicate
protection, undo, localization, or Supabase integration already implemented.

This is not a request to create several independent chatbots. The target is one
Telegram entry point backed by:

- an intake normalizer;
- an intent and capability router;
- specialist workflow handlers;
- deterministic validation;
- human approval boundaries;
- safe tool/database execution;
- persisted workflow state;
- audit and observability records.

## Recommended session order

1. `01_ORCHESTRATION_FOUNDATION_PLAN.md`
2. `02_MULTI_INTENT_TRANSACTION_PLAN.md`
3. `03_CONVERSATION_WORKFLOW_PLAN.md`
4. `04_RECEIVABLES_AGENT_PLAN.md`
5. `05_INVOICE_READINESS_AGENT_PLAN.md`
6. `06_INSIGHTS_AND_OBSERVABILITY_PLAN.md`
7. `07_HARDENING_AND_DEMO_PLAN.md`

Complete and verify each session independently. Commit each session separately.

## Target architecture

```text
Telegram update
  -> transport adapter
  -> intake normalization
  -> orchestration service
      -> route one or more intents
      -> invoke specialist workflow(s)
      -> validate proposed effects
      -> collect clarification when needed
      -> present combined review
      -> wait for explicit confirmation
      -> execute controlled tools
      -> persist audit outcome
  -> Telegram response
```

## Core principles

- Agents propose; deterministic application services validate and execute.
- Financial writes require an explicit confirmation boundary.
- One message may produce multiple proposed actions.
- Unknown values remain unknown; the model must not fabricate them.
- Workflow state is scoped by owner, Telegram user, and chat.
- Repeated Telegram updates and callbacks must be idempotent.
- Every workflow should be explainable from stored steps and outcomes.
- Existing transaction capture remains functional throughout migration.

## Conceptual domain records

Codex must inspect existing models and adapt these concepts rather than blindly
creating all fields.

### Orchestration run

Potential fields:

- `id`
- `owner_id` or business/workspace membership reference
- `telegram_user_id`
- `telegram_chat_id`
- `source_update_id`
- `source_message_id`
- `status`
- `input_kind`
- `locale`
- `raw_text_reference` or redacted input metadata
- `started_at`
- `completed_at`
- `failure_code`
- `created_at`
- `updated_at`

Suggested statuses:

- `received`
- `routing`
- `awaiting_clarification`
- `awaiting_confirmation`
- `executing`
- `completed`
- `partially_completed`
- `cancelled`
- `failed`
- `expired`

### Orchestration step

Potential fields:

- `id`
- `run_id`
- `step_key`
- `agent_type`
- `sequence`
- `status`
- `input_summary`
- `output_summary`
- `error_code`
- `attempt_count`
- `started_at`
- `completed_at`

Avoid persisting secrets, complete provider payloads, raw receipt contents, or
unnecessary personal/financial text.

### Proposed action

Potential fields:

- `id`
- `run_id`
- `action_type`
- `status`
- `payload`
- `validation_errors`
- `requires_confirmation`
- `confirmed_at`
- `executed_at`
- `result_entity_type`
- `result_entity_id`
- `idempotency_key`

Suggested action types:

- `create_transaction`
- `update_transaction_draft`
- `create_receivable`
- `record_receivable_payment`
- `prepare_invoice_draft`
- `inventory_adjustment`
- `answer_insight_query`

Do not introduce unsupported actions merely to fill the list.

## Cross-session acceptance criteria

By the final session:

- Existing single-transaction Telegram flows still work.
- One natural-language message can produce multiple reviewable actions.
- Follow-up replies continue the correct active workflow.
- Transactions and receivables are separately modeled where appropriate.
- Invoice readiness identifies missing fields without submitting to MyInvois.
- Read-only insights use confirmed, owner-scoped data.
- Duplicate Telegram deliveries cannot duplicate financial writes.
- Traces expose steps and errors without exposing sensitive raw content.
- All supported locales have user-facing copy for new flows.
- Tests cover happy paths, malformed output, stale callbacks, cross-user access,
  retries, provider failures, and partial execution.

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
