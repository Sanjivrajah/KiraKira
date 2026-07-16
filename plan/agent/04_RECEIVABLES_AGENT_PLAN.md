# Session 4 — Receivables Specialist Agent

## Objective

Add a specialist workflow for money owed to the business and payments collected
against those debts.

This is separate from a normal paid sale transaction. Codex must inspect the
existing transaction and invoice models and decide the cleanest integration.

## Supported initial intents

- create an outstanding receivable;
- record full or partial payment;
- list outstanding receivables;
- show one customer's balance;
- prepare a reminder message for owner review.

Do not automatically message customers or integrate WhatsApp in this session.

## First inspect

Find existing entities for:

- customers/contacts;
- transactions and payment status;
- invoices;
- counterparties;
- businesses/workspaces;
- audit fields;
- money/currency representation;
- soft deletion or voiding.

Avoid duplicating a receivable concept already represented in invoices or
transactions.

## Suggested conceptual fields

Adapt to the repository.

### Receivable

- `id`
- `owner_id` or workspace/business reference
- `customer_id` when known
- `customer_display_name`
- `source_transaction_id` or invoice reference when applicable
- `original_amount`
- `outstanding_amount`
- `currency` constrained to supported values
- `issued_on`
- `due_on`
- `status`
- `notes`
- `source`
- `created_at`
- `updated_at`
- `settled_at`
- audit/void fields consistent with existing models

Statuses could include:

- `open`;
- `partially_paid`;
- `paid`;
- `overdue`;
- `voided`.

Do not persist a derived `overdue` status if the repository consistently derives
it from dates.

### Receivable payment

- `id`
- `receivable_id`
- `amount`
- `paid_on`
- `payment_method`
- `reference`
- `source_transaction_id`
- `created_at`
- idempotency/audit fields.

## Work items

### 1. Create schemas and domain rules

Rules should cover:

- positive MYR amounts;
- payment cannot exceed outstanding amount unless overpayment policy exists;
- full and partial settlement;
- due-date validation;
- safe customer matching;
- void behavior;
- rounding using existing money utilities.

### 2. Add extraction and routing

Examples:

- “Ali owes me RM40 for catering yesterday.”
- “Ali paid RM20 just now.”
- “Who still owes me money?”
- “Draft a reminder for overdue customers.”

When several customers match, ask the owner to choose. Do not guess.

### 3. Add repositories and migrations

Include owner scoping, indexes, foreign keys, RLS, auditability, and idempotency.
Update generated database types through the repository's established process.

### 4. Add Telegram review flows

Create a review card before write actions.

For read-only queries, return bounded results with:

- customer;
- original amount;
- paid amount;
- outstanding amount;
- due/overdue information.

Avoid exposing unrelated customer details.

### 5. Reminder drafting

Generate a polite reminder draft using known facts only. Require the owner to
copy or approve it; do not send externally.

## Tests

Cover:

- create receivable;
- partial payment;
- full payment;
- attempted overpayment;
- duplicate payment message;
- customer ambiguity;
- unknown receivable;
- overdue calculation around Malaysia timezone;
- voided receivable exclusion;
- owner isolation;
- multi-intent message with sale plus receivable;
- localized extraction;
- read query result limits.

## Done when

- Telegram can create and settle receivables safely.
- Outstanding totals reconcile from tested domain rules.
- Receivable writes use the shared orchestration confirmation boundary.
- Read queries are owner-scoped and bounded.
- No customer reminder is sent automatically.

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
