# NiagaAI documentation

This folder is the entry point for people and AI agents working in NiagaAI.
Read this page before exploring broadly, then use the guide for the area you
intend to change.

## What this project is

NiagaAI is a mobile-first financial workspace for Malaysian micro-business
owners. It turns everyday evidence into **owner-reviewed** financial records.
The product is deliberately conservative: an extraction is a proposal, local
guidance is not compliance approval, and a readiness check is not a submission
to MyInvois or a lender.

Today the repository contains two runnable, local-first applications:

1. A Next.js App Router workspace for onboarding, transaction capture/review,
   invoices, reminders, and preview dashboards.
2. A Telegram transaction agent that accepts text and voice notes, asks for
   missing information, presents a draft, and persists only explicitly
   confirmed records to local JSON files.

Neither is production financial storage. The web app stores demo records in
the browser; the bot stores development data in `LOCAL_DATA_DIRECTORY`.

## Start here

| If you need to… | Read |
| --- | --- |
| Understand layers, ownership, and data flow | [Architecture](architecture.md) |
| Add or modify code while following project patterns | [Engineering conventions](engineering-conventions.md) |
| Change Telegram commands, conversation flow, or its local persistence | [Telegram agent](telegram-agent.md) |
| Understand the purpose and current product claims | [`PRODUCT.md`](../PRODUCT.md) |
| Run the project, configure integrations, or use the demo | [`README.md`](../README.md) |
| See the documentation scope and upkeep rules | [Documentation plan](documentation-plan.md) |

## Fast orientation map

```text
src/app/                 Next.js routes and Route Handlers
src/components/          UI grouped by product feature
src/hooks/               React Query access to browser-local services
src/services/            UI-facing application operations
src/repositories/        repository contracts and browser-local adapters
src/domain/              canonical financial/domain models (parallel migration layer)
src/frontend/            canonical-to-UI view models and storage migration
src/lib/                 focused infrastructure and pure utilities
src/compliance/          MyInvois mapping, rules, fixtures, and reference data
src/features/transaction-agent/  Telegram transaction use cases and state machine
src/bot/                 grammY transport, messages, and keyboards
src/data/demo/           deterministic demo fixtures and legacy adapters
```

## Non-negotiable product rules

- Keep financial extraction reviewable and require owner confirmation before
  treating it as a confirmed record.
- State demo/local-only limitations plainly. Do not imply live MyInvois,
  banking, WhatsApp, lending, database, or compliance approval.
- Preserve evidence/provenance where the model supports it, without exposing
  provider internals as the primary user experience.
- Protect secrets and raw evidence. Server-only credentials never enter client
  components, browser storage, test fixtures, or logs.
- Preserve existing browser-local contracts while the canonical domain
  migration remains in progress; use adapters and versioned migrations.

## Working agreement for agents

`AGENTS.md` is required reading and contains framework, security,
accessibility, and verification rules. In particular, inspect the installed
Next.js 16 documentation before changing framework behavior, preserve
unrelated working-tree changes, and run the applicable checks before handoff.
