# Multi-intent transaction orchestration — implementation decision log

## Delivered boundary

- `multi-intent.schema.ts` defines strict, bounded structured output for at
  most four independently reviewable actions. It separates executable
  transaction proposals from `receivable_capture` and unsupported routing
  placeholders.
- `multi-intent-extractor.ts` adds the provider boundary and prompt for text
  or voice-transcript extraction. It retains the existing explicit review rule:
  model output is only a proposal.
- `action-bundle.ts` defines a bundle of two to four pending transaction drafts
  and a confirm-all service. It rechecks bundle ownership, active status, and
  every required field before any confirmation.

## Actual model and deviation

The current transaction agent has a single-draft conversation state and no
receivables table or repository. Therefore, `receivable_capture` is routed and
reported as unsupported rather than incorrectly mapped into a transaction.

The local JSON transaction repositories have independent file writes and no
multi-record transaction. If a write unexpectedly fails after prevalidation,
the bundle service returns `partial_failure` with the confirmed and failed
draft identifiers. A transport layer must present this state safely and must
never claim the entire bundle was saved.

## Remaining wiring

The transport/conversation integration is intentionally not enabled by this
domain-only change: it still needs persisted bundle state in both local and
Supabase modes, action-scoped clarification/edit callbacks, combined numbered
review copy/keyboards, and an idempotent confirm-all callback. Single-action
flows remain unchanged.

## Verification

- Focused multi-intent and bundle tests pass.
- Typecheck and `git diff --check` pass.
