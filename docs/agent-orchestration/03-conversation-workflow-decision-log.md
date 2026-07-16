# Durable conversation workflows — implementation decision log

## Delivered boundary

- The existing per-user/per-chat conversation record is now an explicit,
  versioned `transaction_capture` workflow with a workflow UUID, finite status,
  expiry timestamp, requested field, current action slot, and structured
  collected-values context.
- The existing `mode` remains as a compatibility field for the current Telegram
  presentation layer. Its legacy values map deterministically to generic
  workflow statuses.
- Free-form replies resume only the scoped active workflow. A second request at
  review remains guarded by the existing replace-or-keep choice; it cannot
  silently overwrite a financial draft.
- Expired text and callback interactions become terminal `expired` workflows,
  cancel their pending draft without executing it, and give the owner a clear
  restart instruction.

## Persistence and migration

- Local JSON reads accept the old conversation format and apply safe defaults;
  the next save writes version 1 workflow fields. Invalid JSON is still never
  deleted automatically.
- `20260717100000_telegram_generic_workflow_state.sql` backfills existing
  Supabase rows and adds workflow metadata while preserving the existing draft
  JSON, scoped account relation, expiry, and optimistic `version` update.
- The workflow table retains one current workflow per Telegram account, matching
  the existing active-draft product behavior. The redacted orchestration
  run/step log remains the durable multi-run audit trail; specialist workflow
  history will need a separate append-only table before concurrent workflows
  are introduced.

## Deviation and follow-up

`actionBundle.ts` is not yet persisted or wired into Telegram transport from
Session 2, so item-scoped bundle corrections are intentionally deferred. The
generic `currentActionId` and `collectedValues` fields provide the persistence
seam for that follow-up without pretending the current single-draft UI supports
it.

## Verification

- Focused conversation, input-processor, and bot tests pass.
- Typecheck and diff whitespace checks pass.
