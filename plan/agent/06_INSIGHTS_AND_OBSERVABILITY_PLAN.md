# Session 6 — Financial Insights and Agent Observability

## Objective

Add a read-only financial insights capability and an internal orchestration
trace surface. Insights must be calculated from confirmed, owner-scoped records,
not generated directly from raw Telegram messages.

## Supported initial questions

- sales and expenses for a bounded period;
- estimated profit for a bounded period;
- outstanding receivables;
- biggest expense categories;
- recent transactions;
- simple cash-in/cash-out comparison;
- explanation of why profit and available cash may differ.

Do not present accounting estimates as audited financial statements.

## First inspect

Find:

- existing `/summary`, `/search`, and `/export` logic;
- transaction summary calculations;
- web dashboard metrics;
- categories and statuses;
- void exclusion behavior;
- date range parsing;
- money formatting;
- Supabase queries and owner scoping;
- any audit/admin pages.

Reuse one calculation layer across Telegram and web where possible.

## Work items

### 1. Create deterministic insight queries

Implement typed query services for each supported metric.

Requirements:

- explicit or bounded default date range;
- Malaysia timezone handling;
- confirmed records only;
- void/cancel exclusion;
- owner scope;
- pagination/result limits;
- consistent MYR rounding;
- no model-generated arithmetic.

### 2. Add insight intent routing

The model may map natural language to a typed query:

```ts
{
  kind: "profit_summary",
  dateRange: { from: "...", to: "..." }
}
```

Validate the query and execute calculations in code.

### 3. Generate plain-language explanation

The model may explain already-calculated values, but pass only the minimum
aggregated data required. Include a disclaimer such as “estimated from recorded
transactions” when appropriate.

### 4. Add orchestration metrics

Record or derive:

- runs by capability;
- completion/failure count;
- average duration;
- clarification frequency;
- confirmation rate;
- duplicate prevention count;
- provider failure count;
- validation failure codes.

Do not store raw prompts or raw financial inputs merely for analytics.

### 5. Add developer trace view or command

Choose the safest existing surface:

- a development-only web route;
- structured server logs;
- or a restricted Telegram debug command.

Display:

- run timeline;
- capability;
- safe step summaries;
- status;
- duration;
- safe error codes.

Never expose service-role operations, secrets, complete provider responses, or
other owners' traces.

### 6. Add cost and timeout controls

Centralize:

- provider timeouts;
- retry policy;
- maximum model calls per run;
- maximum actions per message;
- maximum clarification turns;
- input sizes;
- safe fallback messages.

Retries must not repeat database effects.

## Tests

Cover:

- each supported calculation;
- date boundary and timezone cases;
- empty period;
- voided records;
- partially paid receivables;
- malformed date request;
- result limit;
- model query mapping failure;
- provider explanation failure with deterministic fallback;
- trace authorization;
- redaction;
- timeout and retry behavior.

## Done when

- Telegram answers supported financial questions using deterministic data.
- Explanations cite the period and basis of calculation.
- Developers can inspect run steps without viewing sensitive raw content.
- Provider failure still returns a safe calculated summary where possible.

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
