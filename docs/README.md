# NiagaAI documentation

Use this directory as the repository map. The short guides explain how the running system fits together; the specialist runbooks cover Supabase and MyInvois work in more detail.

## First reads

| Need | Guide |
| --- | --- |
| Install and run the project locally | [Getting started](getting-started.md) |
| Understand the runtimes, layers, and trust boundaries | [Architecture](architecture.md) |
| Know where each environment variable belongs | [Configuration](configuration.md) |
| Deploy the web app, Telegram worker, and database | [Deployment](deployment.md) |
| Find a page, feature, or client-side data flow | [Web application](web-application.md) |
| Work with the HTTP Route Handlers | [HTTP API](http-api.md) |
| Understand the Supabase schema and record ownership | [Data model](data-model.md) |
| Change the Telegram worker or its persistence | [Telegram agent](telegram-agent.md) |
| Run the synthetic Telegram walkthrough | [Telegram demo](telegram-demo.md) |
| Follow repository-specific coding patterns | [Engineering conventions](engineering-conventions.md) |

## Specialist guides

| Area | Guide |
| --- | --- |
| Browser-local to Supabase adapter boundary | [Supabase web repositories](supabase-web-repository-migration.md) |
| Migrations, imports, backups, and incidents | [Supabase operations](supabase-operations.md) |
| Transaction creation and read paths | [Transaction data flow](transaction-data-flow.md) |
| Loan-readiness calculations and limitations | [Loan readiness](loan-readiness-implementation.md) |
| e-Invoice preparation and approval | [e-Invoice preparation](e-invoice-preparation.md) |
| MyInvois persistence and assembly | [Persistence and assembly](backend/05-e-invoice-persistence-and-assembly.md) |
| UBL mapping and immutable payloads | [UBL payload snapshots](backend/06-e-invoice-ubl-payload-snapshots.md) |
| MyInvois OAuth connections | [Taxpayer and intermediary authentication](backend/07-e-invoice-taxpayer-intermediary-authentication.md) |
| Sandbox submission and reconciliation | [Sandbox submission](backend/08-e-invoice-sandbox-submission-status.md) |
| Production activation and incident handling | [Production operations](backend/09-e-invoice-production-operations.md) |
| Browser voice-agent setup | [ElevenLabs voice agent](voice-agent.md) |
| MyInvois field coverage reference | [Invoice v1.0 field requirements](reference/myinvois-invoice-v1.0-fields.md) |

## Repository map

```text
src/app/                          pages, layouts, and HTTP Route Handlers
src/components/                   browser UI grouped by product feature
src/hooks/                        React Query reads, mutations, and invalidation
src/services/                     UI-facing business operations
src/repositories/                 storage contracts plus local and Supabase adapters
src/domain/                       canonical schemas, money rules, and calculations
src/frontend/                     legacy/canonical view models and browser migrations
src/application/e-invoices/       e-Invoice preparation, payload, and submission use cases
src/compliance/myinvois/          reference data, validation, UBL mapping, and fixtures
src/integrations/myinvois/        OAuth, secrets, and MyInvois HTTP transport
src/features/transaction-agent/   Telegram state machine and bookkeeping use cases
src/bot/                          grammY transport, messages, keyboards, and startup
src/lib/                          focused provider clients and shared infrastructure
supabase/migrations/              ordered database source of truth
supabase/tests/database/          pgTAP/RLS database tests
scripts/                          explicit imports and repeatable demo tooling
```

## Product boundaries

- A model extraction is a draft—not a financial record.
- A person must review and confirm financial changes before they become authoritative.
- MyInvois readiness and local validation do not prove acceptance by HASiL.
- Loan readiness is an indicative calculation—not an offer or approval.
- Demo mode is isolated to one browser and must never be presented as production storage.
- The Telegram worker uses Supabase in deployment; its JSON adapter is only for local development and repeatable demos.

`PRODUCT.md` is the product source of truth. `AGENTS.md` is the engineering source of truth—read both before changing behavior.

## Keeping the docs honest

Update the relevant guide in the same change whenever a route, command, environment variable, persistence boundary, external provider, or deployment responsibility changes. Prefer present-tense descriptions of the code that exists. Plans and session notes do not belong in this documentation tree once their work has landed—keep durable decisions and operational instructions instead.
