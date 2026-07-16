# Session 3 — Durable Conversation Workflows

## Objective

Upgrade active conversation state into a generic, durable workflow mechanism so
follow-up messages continue the correct task and the system can support several
specialist agents over time.

## First inspect

Review:

- current conversation state schema and expiry behavior;
- local and Supabase conversation repositories;
- how corrections and clarification replies are interpreted;
- Telegram private-chat/group-chat assumptions;
- `/cancel`, `/start`, `/link`, and other command behavior;
- current timezone and locale handling.

## Work items

### 1. Define workflow state machine

Model finite states explicitly, such as:

- `collecting_input`;
- `routing`;
- `awaiting_clarification`;
- `awaiting_confirmation`;
- `duplicate_warning`;
- `executing`;
- `completed`;
- `cancelled`;
- `expired`;
- `failed`.

Store a workflow type/capability and a version so future schema changes can be
migrated safely.

### 2. Create generic workflow context

Potential fields:

- workflow/run ID;
- workflow type;
- owner/workspace ID;
- Telegram user and chat IDs;
- source message ID;
- current state;
- current action ID;
- requested field key;
- collected structured values;
- expiry timestamp;
- version;
- optimistic concurrency token or updated timestamp.

Use existing fields where they already exist.

### 3. Implement resume logic

For each new Telegram message:

1. identify command vs callback vs free-form input;
2. find active scoped workflow;
3. determine whether the input answers the pending question;
4. otherwise decide whether to start a new workflow;
5. prevent accidental overwriting of an active financial draft.

Define UX for starting another task while one is active. A safe default is to
ask the user to complete/cancel the current task rather than guessing.

### 4. Add expiry and recovery

Expired workflows should:

- stop accepting callbacks;
- avoid deleting audit history;
- give a clear restart action;
- clean temporary state safely;
- never execute pending actions.

### 5. Add correction semantics

Support corrections such as:

- `amount is RM45`;
- `change item 2 to expense`;
- `customer is Ali`;
- localized equivalents where current language support exists.

Use deterministic field selection when possible. The model may interpret the
correction, but the resulting patch must be schema-validated and limited to
allowed editable fields.

### 6. Version and migration behavior

If existing local JSON or Supabase rows use an earlier conversation format:

- provide compatible read defaults or migration;
- do not destroy unreadable state automatically;
- document rollback behavior.

## Tests

Cover:

- clarification reply resumes workflow;
- unrelated new input while workflow active;
- cancel and restart;
- expired workflow;
- stale callback after expiry;
- correction to one item in a bundle;
- malformed correction;
- repeated message;
- concurrent callbacks;
- user/chat isolation;
- local-state migration;
- Supabase optimistic concurrency or serialized update behavior.

## Done when

- Workflow state is generic rather than transaction-handler-specific.
- Follow-ups are routed to the correct pending field/action.
- Expired and stale interactions fail safely.
- New specialist workflows can reuse the same state machinery.

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
