# NiagaAI

NiagaAI is a mobile-first financial workspace concept for Malaysian micro-business owners. The current app includes a complete browser-local first-time journey:

```text
Welcome → Sign in or Sign up → Business onboarding → Dashboard
```

It also includes the frontend roadmap’s transaction and invoicing journeys:

```text
Choose a source → Capture or import evidence → Review each proposed transaction → Save locally
Create invoice → Check totals and readiness → Save locally → Preview reminder
```

## Current Scope

Phase 0 through Phase 2 of `plan_frontend_first.md` are complete.

- Responsive public welcome, sign-in, sign-up, onboarding, and dashboard routes
- Explicit browser-local demo or Supabase Auth modes; financial records remain local in this foundation session
- React Hook Form and Zod validation with accessible field feedback
- A versioned Zustand session persisted to local storage
- Hydration-aware client route guards
- Business-details review and explicit completion state
- Dashboard identity populated from the saved demo profile
- Confirmed sign-out and full demo-reset actions
- Focused validation, store, and component tests
- OpenAI receipt-image extraction with bulk review
- ElevenLabs Scribe v2 voice transcription followed by OpenAI transaction structuring
- Deterministic, browser-local CSV and bank-CSV parsing for up to 100 rows
- OpenAI PDF bank-statement extraction with strict file validation
- WhatsApp capture preview that remains clearly labelled as a demo
- Editable transaction review with provenance-specific extraction disclosures
- Resilient browser-local transaction storage and completion actions
- Searchable invoice tracking with draft, sent, paid, and derived overdue states
- Multi-line invoice builder with automatic subtotal, tax, and total calculations
- Transparent frontend-only e-invoice readiness checks
- Upcoming and overdue reminder previews with locally persisted reminder history

Database persistence, MyInvois submission, and production financial storage remain out of scope. Receipt images and PDF bank statements use the configured OpenAI API. Voice notes use ElevenLabs for transcription and OpenAI for structured transaction extraction. CSV imports are parsed locally without an AI call.

## Demo Access

Open `http://localhost:3000` after starting the app. You can create any valid demo account, or choose **Fill demo details** on the sign-in page to use:

```text
Email: lina@niagaai.demo
Password: demo1234
```

The password only demonstrates form validation. It is never compared with a server value, placed in global state, or persisted. The documented email `error@niagaai.demo` triggers the deterministic mock sign-in error.

## Supabase Auth

Supabase is available locally for development. It authenticates users only in this
foundation session; browser-local business, transaction, invoice, and reminder
repositories intentionally remain unchanged until the later migration sessions.

For the local-to-hosted migration workflow, explicit local-data import process,
production deployment checks, backup/rollback, and incident response, read
[`docs/supabase-operations.md`](docs/supabase-operations.md). Browser-local
records are exported and imported only by an explicit user action; they never
silently migrate on page load.

### Prerequisites

- Node.js 20.9 or newer and npm 10 or newer
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) running for local Supabase

### First-time local Supabase setup

```bash
npm install
npm run supabase:start
npm run supabase:status -o env
cp .env.example .env.local
```

Copy the local API URL and publishable (or anon) key printed by `supabase:status`
into `.env.local`, then select Supabase mode:

```bash
NEXT_PUBLIC_AUTH_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local publishable-or-anon-key>
```

For browser-local demo mode, set `NEXT_PUBLIC_AUTH_MODE=demo`. In development,
an omitted mode defaults to demo for compatibility; production treats an omitted
mode as Supabase, so missing credentials produce a clear configuration failure
rather than a silent demo fallback. Use the browser-safe Supabase publishable
key, never a secret or service-role key.

Useful local commands:

```bash
npm run supabase:start
npm run supabase:status
npm run supabase:stop
npm run supabase:reset  # destroys local Supabase data
npm run supabase:types  # writes src/lib/supabase/database.types.ts
```

`supabase/migrations/` is the schema source of truth and generated database
types live at `src/lib/supabase/database.types.ts`. Local Supabase Studio,
database URLs, and all local keys are printed by `npm run supabase:status`; do
not commit those values. While running the Next.js app in development,
`/api/health/supabase` reports whether demo mode is active or the configured
local/hosted Supabase Auth endpoint is reachable without exposing credentials.

## Local Persistence and Security

The sanitized demo session is stored only in the current browser under `niagaai-demo-session`. Reviewed transactions, invoices, and simulated reminder history use the separate `niagaai_transactions`, `niagaai_invoices`, and `niagaai_reminders` keys.

- Refreshing preserves sign-in and onboarding progress after client hydration.
- Another browser or device starts with its own separate demo session.
- **Sign out** clears the active user session but retains the local business profile.
- **Reset demo** removes the local user, business profile, onboarding progress, transactions, invoices, and reminder history.
- Clearing browser site data has the same effect as resetting the demo.

The route guards improve demo navigation only. Browser-local state is not a security boundary and does not provide real authentication or authorization.

CSV files remain in the browser. Receipt images and PDF bank statements are sent to OpenAI with response storage disabled. Voice audio is sent to ElevenLabs, then its transcript is sent to OpenAI with response storage disabled. Every extracted value remains a proposed draft until the owner confirms it.

## Requirements

- Node.js 20.9 or newer
- npm 10 or newer recommended

## Local Development

```bash
npm install
npm run dev
```

## Telegram Transaction Agent (Local MVP)

The Telegram transaction agent runs separately from the Next.js app using long polling. It accepts English, Bahasa Melayu, and Manglish transaction text or Telegram voice notes. Voice notes are transcribed with ElevenLabs and then use the same review flow as text. Transactions remain local and are saved only after confirmation.

1. Create a bot through [Telegram's BotFather](https://t.me/BotFather): send `/newbot`, follow its prompts, and copy the token it provides.
2. Copy the environment template and add the token. Never commit the resulting file.

   ```bash
   cp .env.example .env.local
   ```

   Set `TELEGRAM_BOT_TOKEN`, `OPENAI_API_KEY`, `OPENAI_TRANSACTION_MODEL`, and `ELEVENLABS_API_KEY` in `.env.local`. `ELEVENLABS_STT_MODEL` defaults to `scribe_v2`, `MAX_VOICE_FILE_BYTES` defaults to 20 MiB, and `LOCAL_DATA_DIRECTORY` defaults to `./data`.
3. Install dependencies, then start the bot in a separate terminal:

   ```bash
   npm install
   npm run bot:dev
   ```

   Use `npm run bot:start` for a non-watching process. Stop either command with `Ctrl+C`.

Open your bot in Telegram and use these commands:

- `/start` — introduction and a quick example
- `/help` — supported transaction types and examples
- `/transactions` — your latest 10 confirmed transactions
- `/summary` — a basic cash-movement summary
- `/cancel` — cancel an active correction or clarification
- `/settings` — choose an English or Bahasa Melayu interface

The persistent home keyboard provides **Record transaction**, **Recent transactions**, **Summary**, and **Help**, so slash commands are optional. Try text such as `Semalam beli ayam RM85 cash dekat Pasar Borong`, `Customer Ravi transfer RM450 for catering semalam`, or `Sold 10 nasi lemak RM5 each cash today`. You can also send a Telegram voice note containing the same details. NiagaAI shows temporary processing feedback, asks one contextual question at a time, and displays a concise draft. Constrained questions and correction fields have quick-answer buttons, while natural-language replies always remain available.

Before saving a likely duplicate, NiagaAI shows the matching confirmed transaction. **Save anyway** is a second explicit confirmation for legitimate repeated transactions; **Cancel** creates nothing. Only one draft can be active for a user and chat; a second transaction requires an explicit keep, discard, or cancel choice. After confirmation, **Undo last save** is available for five minutes and marks the record `voided` instead of deleting its audit evidence. `/transactions` and `/summary` omit voided records. The summary keeps customer debt repayments separate from sales income and is not an audited accounting or profit-and-loss statement.

Conversation state is isolated per Telegram user and chat, so a clarification started in one chat is not consumed in another. Confirmation actions are idempotent within the local bot process: rapid button presses and safe retries do not create a second copy of the same transaction.

Local files are created on first use at `data/transaction-drafts.json`, `data/transactions.json`, `data/conversation-states.json`, and `data/telegram-user-preferences.json` (or inside `LOCAL_DATA_DIRECTORY`). Existing MVP transaction JSON remains readable without a destructive rewrite. To reset local development data, stop the bot, delete those generated JSON files, then restart it. Do not delete data automatically if a file is corrupt; inspect or back it up first.

### Telegram Stage 1 manual checklist

Verify on both phone and desktop before a demo:

1. Open `/start`; use every home button and `/help`, `/transactions`, `/summary`, `/settings`, and `/cancel`.
2. Capture English, Bahasa Melayu, and Manglish text plus short and long voice notes; confirm temporary status messages disappear.
3. Exercise every missing-field button and answer the same prompts with natural language.
4. Exercise every correction field, free-form correction, and cancellation from clarification and correction.
5. Send a second transaction while reviewing a draft; test keep, discard-and-start, and cancel-new.
6. Confirm, cancel, duplicate, undo, expired undo, repeated button, stale button, and another-user button paths.
7. Switch both interface languages and test long descriptions, Unicode names, Telegram special characters, and 200% text scaling.
8. Simulate OpenAI, ElevenLabs, local-storage, and Telegram failures; verify no financial record is silently saved and recoverable draft state remains available.

This is development-only local storage, not a security boundary. Do not use it for sensitive production financial records. Receipt/image extraction, databases, WhatsApp, MyInvois submission, inventory, authentication, and production deployment are not part of this Telegram MVP. Unsupported media receives a short text-and-voice-only notice.

## Quality Checks

```bash
npm run test
npm run lint
npm run typecheck
npm run build
```

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Public welcome page |
| `/login` | Mock sign-in |
| `/signup` | Local demo account creation |
| `/onboarding` | Hydration-gated business setup and review |
| `/dashboard` | Hydration-gated Phase 1 application preview |
| `/transactions` | Filter, sort, review, edit, and delete local transactions |
| `/transactions/new` | Receipt extraction, voice transcription, local CSV parsing, bank-statement import, review, and local save |
| `/invoices` | Filterable local invoice tracking and status updates |
| `/invoices/new` | Invoice builder, live preview, calculations, and readiness check |
| `/invoices/[id]` | Reopen a saved invoice, update status, or delete it |
| `/reminders` | Upcoming and overdue payment reminder previews |

## Project Structure

```text
src/
├── app/                 # App Router pages and global styles
├── components/
│   ├── auth/            # Auth cards, forms, and route gate
│   ├── forms/           # Accessible shared form controls
│   ├── onboarding/      # Details, review, progress, and success
│   ├── dashboard/
│   ├── transactions/    # Capture sources, processing, review, and success
│   ├── invoices/        # Invoice builder, live preview, and tracking
│   ├── reminders/       # Local reminder cards and message preview
│   ├── layout/
│   └── shared/
├── lib/                 # Validation, CSV imports, OpenAI extraction, calculations, and local storage
├── store/               # Persisted Zustand demo session
└── types/               # Auth and business contracts
```
