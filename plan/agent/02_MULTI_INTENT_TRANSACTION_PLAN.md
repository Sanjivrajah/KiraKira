# Session 2 — Multi-Intent Transaction Orchestration

## Objective

Allow one Telegram text or voice message to produce several proposed financial
actions, such as a sale, expense, and outstanding payment, while preserving one
combined confirmation experience.

Receipt images should remain single-receipt inputs unless the existing
implementation safely supports more.

## Example target input

> Semalam jual 20 nasi lemak RM5 satu, beli bahan RM30, Ali belum bayar RM15.

Potential proposals:

- sale transaction of RM100;
- expense transaction of RM30;
- receivable of RM15 for Ali.

The exact domain mapping must follow existing schemas.

## First inspect

Find:

- the current extraction prompt and structured output schema;
- required transaction fields;
- transaction category/type enums;
- clarification logic;
- duplicate detection;
- callback payload limits and keyboard conventions;
- how drafts are stored and confirmed;
- whether receivables already exist in the data model.

## Work items

### 1. Add multi-intent extraction schema

Create a bounded structured output containing:

- a list of detected intents;
- confidence or uncertainty marker if already used;
- a list of proposed actions;
- missing fields per action;
- source span or short evidence summary where safe;
- global ambiguity notes.

Set strict limits, for example a maximum number of actions per message, after
considering model cost and Telegram UX.

Do not use confidence alone as authorization.

### 2. Split routing from extraction

The router should select supported capabilities. Specialist parsers should
produce their domain proposals.

A reasonable initial capability set:

- `transaction_capture`;
- `receivable_capture` only when implemented or safely staged;
- `unsupported`.

Do not add invoice, inventory, or insights behavior in this session beyond
routing placeholders.

### 3. Create an action bundle

A bundle should support:

- independent action identifiers;
- per-action validity;
- per-action missing fields;
- bundle-level status;
- source message identity;
- confirmation state.

Determine whether to extend existing draft storage or introduce a separate
bundle table/document. Prefer the smallest coherent change.

### 4. Build combined clarification

Ask for one high-value missing field at a time.

The clarification mechanism must know:

- which action is being clarified;
- which field is being requested;
- what has already been collected;
- when the bundle can move to review.

Avoid ambiguous replies such as asking “What is the amount?” when multiple
actions are missing amounts. Include the action context.

### 5. Build combined review UI

Telegram response should clearly number actions:

```text
I found 3 items:

1. Sale — RM100
2. Expense — RM30
3. Outstanding from Ali — RM15

Confirm all, edit an item, or cancel?
```

Use existing localization and keyboard helpers.

Support at least:

- confirm all;
- edit/select an action;
- cancel all.

Partial confirmation should only be added if it can be represented safely and
tested thoroughly; otherwise defer it.

### 6. Execute atomically where possible

For confirmation:

- revalidate every action;
- recheck ownership and active state;
- use idempotency keys;
- write all actions transactionally if the database model supports it;
- return a safe partial-failure state if atomicity is impossible.

Never silently save only part of a bundle.

## Tests

Cover:

- two valid transactions in one message;
- mixed sale and expense;
- one valid and one incomplete action;
- Manglish/Bahasa example;
- duplicated action in the same message;
- repeated confirm callback;
- stale callback;
- action edit;
- cancellation;
- maximum action limit;
- provider output with unsupported intent;
- cross-chat and cross-user access;
- atomic or explicit partial-failure behavior.

## Done when

- A single text or voice message can produce multiple numbered proposals.
- Missing fields are collected against the correct proposal.
- Confirmation cannot duplicate writes.
- Existing one-action messages still use a simple UX.
- Unsupported intents are reported without losing supported proposals.

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
