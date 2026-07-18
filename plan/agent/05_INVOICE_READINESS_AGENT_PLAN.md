# Session 5 — Invoice Readiness Specialist Agent

## Objective

Use confirmed transaction/customer/business data to prepare an invoice or
e-invoice-ready draft and identify missing fields. Do not submit anything to
MyInvois in this session unless a separate, already-approved integration exists.

## First inspect

Review all existing:

- invoice/e-invoice schemas;
- LHDN field mapping documentation;
- transaction record fields;
- seller/business profile fields;
- customer/buyer fields;
- tax/category/code enums;
- Supabase tables and migrations;
- UI forms for invoice data;
- any 54-field coverage documentation.

The agent must reuse canonical schemas rather than inventing a simplified
invoice model.

## Work items

### 1. Build a readiness evaluator

The evaluator should be deterministic and return:

- ready/not ready;
- missing required fields;
- invalid fields;
- conditional fields;
- warnings;
- source entity references;
- next best clarification question.

Separate:

- universally required fields;
- fields required by transaction type;
- buyer/seller identity fields;
- tax and classification fields;
- line item calculations;
- optional business metadata.

### 2. Add invoice-preparation intent

Examples:

- “Create invoice for Siti for yesterday's catering RM500.”
- “Can this transaction be submitted as an e-invoice?”
- “What information is missing for this invoice?”

Resolve existing confirmed entities safely. When multiple transactions or
customers match, ask the user to select.

### 3. Define invoice draft lifecycle

Suggested lifecycle, adapted to existing enums:

- `draft`;
- `needs_information`;
- `ready_for_review`;
- `approved`;
- `submitted` only if already supported;
- `cancelled`;
- `rejected` only if provider integration exists.

Approval for a draft is not equivalent to LHDN submission.

### 4. Collect missing fields conversationally

Reuse the generic workflow state.

Each question should identify its context:

- buyer;
- seller;
- invoice;
- line item;
- tax classification.

Validate each answer immediately and preserve previous valid values.

### 5. Show readiness summary

Telegram should show:

- buyer;
- transaction reference;
- amount/tax totals;
- readiness status;
- missing field count;
- review or continue action.

Avoid dumping all government field names into chat. Provide concise labels and a
web-dashboard link only if a secure existing pattern supports it.

### 6. Add safe invoice tool boundary

The orchestration action may create/update an invoice draft through a typed
application service. It must not call an external submission endpoint directly.

## Tests

Cover:

- fully ready invoice draft;
- missing buyer identifier;
- conditional tax field;
- line total mismatch;
- ambiguous source transaction;
- invalid date;
- draft correction;
- repeated approval callback;
- owner isolation;
- transaction already attached to invoice;
- unsupported transaction type;
- readiness against canonical schema;
- no accidental MyInvois submission.

## Done when

- The bot can assess invoice readiness from canonical project schemas.
- Missing fields are collected one at a time.
- A reviewable invoice draft can be persisted.
- The flow clearly distinguishes “draft ready” from “submitted to LHDN.”
- Existing required-field coverage remains documented and tested.

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
