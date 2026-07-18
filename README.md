# NiagaAI

Niaga AI is a financial workspace for Malaysian micro and small businesses. It turns receipts, voice notes, spreadsheets, bank statements, and Telegram messages into records that the owner can review before anything is saved.

The repository contains two deployable runtimes—a Next.js web application hosted on Vercel and a long-running Telegram worker hosted on Railway. Both use Supabase in the deployed environment. OpenAI handles structured extraction, ElevenLabs handles speech and the browser voice assistant, and the web application owns the MyInvois integration.

## Platform at a glance

```mermaid
flowchart LR
    Browser["Owner in a browser"] --> Web["Next.js web app<br/>Vercel"]
    Telegram["Owner in Telegram"] --> Bot["Telegram worker<br/>Railway"]
    Web --> Supabase["Auth, PostgreSQL and Storage<br/>Supabase"]
    Bot --> Supabase
    Web --> OpenAI["OpenAI"]
    Bot --> OpenAI
    Web --> ElevenLabs["ElevenLabs"]
    Bot --> ElevenLabs
    Web --> MyInvois["MyInvois sandbox / production"]
```

| Runtime | Production host | Entry point | Process model |
| --- | --- | --- | --- |
| Web application and HTTP API | Vercel | `src/app` | Next.js 16 App Router and Node.js Route Handlers |
| Telegram transaction agent | Railway | `src/bot/index.ts` | One persistent Node.js process using grammY long polling |
| Primary data and authentication | Supabase | `supabase/migrations` | PostgreSQL, Auth, RLS, RPCs, and private Storage |

The full system description is in [docs/architecture.md](docs/architecture.md). Deployment ownership and environment-variable placement are in [docs/deployment.md](docs/deployment.md).

## What is implemented

- Supabase authentication, business onboarding, tenant membership, and an explicit browser-local demo mode
- Transaction capture from manual entry, receipt images, voice notes, CSV files, and PDF bank statements
- Reviewed transaction history, dashboard summaries, cash-flow views, reminders, and indicative loan-readiness calculations
- Invoice drafting, lifecycle updates, payment tracking, and immutable e-Invoice preparation revisions
- Unsigned MyInvois Invoice v1.0 mapping, payload snapshots, sandbox submission, status reconciliation, and gated production operations
- A browser voice assistant backed by ElevenLabs Conversational AI, with owner-visible transcript history in Supabase
- A Telegram agent for English, Bahasa Melayu, and Manglish transaction capture, clarification, review, confirmation, duplicate protection, insights, search, and CSV export

Inventory remains a placeholder. Loan readiness is an indicative cash-flow assessment—not a lending decision. Extracted values are proposals until the owner confirms them, and MyInvois readiness is not the same as authority acceptance.

## Local setup

NiagaAI declares Node.js 22 as its runtime. Docker Desktop is also required when running the local Supabase stack.

```bash
npm install
cp .env.example .env.local
```

For the quickest UI-only start, set the explicit demo adapter in `.env.local`:

```text
NEXT_PUBLIC_AUTH_MODE=demo
```

Then run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). In demo mode, use `lina@niagaai.demo` with `demo1234`, or create any valid local demo account. Demo records remain in that browser and are never a production security boundary.

For the full Supabase-backed setup—including migrations, local keys, and the Telegram worker—follow [docs/getting-started.md](docs/getting-started.md).

## Common commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server |
| `npm run bot:dev` | Start the Telegram worker in watch mode |
| `npm run bot:start` | Start the Telegram worker once—the command used by Railway |
| `npm run supabase:start` | Start the local Supabase stack |
| `npm run supabase:reset` | Rebuild the local database from migrations and seed data—local data is destroyed |
| `npm run supabase:types` | Regenerate linked Supabase database types |
| `npm run data:import:telegram` | Preview or import local Telegram JSON into Supabase |
| `npm run data:import:myinvois` | Build or verify a pinned MyInvois reference-data candidate |
| `npm run demo:agent` | Run the synthetic Telegram orchestration demo |

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Database changes also require a clean migration reset and the SQL test suite:

```bash
npx supabase db reset
npx supabase test db
```

## Documentation

Start with the [documentation index](docs/README.md). It links the guides for architecture, configuration, web features, HTTP endpoints, Telegram, Supabase, MyInvois, deployment, and engineering conventions.

`PRODUCT.md` records the product boundary. `AGENTS.md` records the repository’s engineering and verification rules.
