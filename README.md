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

Authentication, database persistence, MyInvois submission, and production financial storage remain out of scope. Receipt images and PDF bank statements use the configured OpenAI API. Voice notes use ElevenLabs for transcription and OpenAI for structured transaction extraction. CSV imports are parsed locally without an AI call.

## Demo Access

Open `http://localhost:3000` after starting the app. You can create any valid demo account, or choose **Fill demo details** on the sign-in page to use:

```text
Email: lina@niagaai.demo
Password: demo1234
```

The password only demonstrates form validation. It is never compared with a server value, placed in global state, or persisted. The documented email `error@niagaai.demo` triggers the deterministic mock sign-in error.

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

## Telegram Transaction Agent (Sessions 1–3)

The Telegram transaction agent runs separately from the Next.js app using long polling. It extracts text transactions into reviewable drafts, then saves only confirmed transactions to local JSON files.

1. Create a bot through [Telegram's BotFather](https://t.me/BotFather): send `/newbot`, follow its prompts, and copy the token it provides.
2. Copy the environment template and add the token. Never commit the resulting file.

   ```bash
   cp .env.example .env.local
   ```

   Set `TELEGRAM_BOT_TOKEN`, `OPENAI_API_KEY`, and `OPENAI_TRANSACTION_MODEL` in `.env.local`. `LOCAL_DATA_DIRECTORY` defaults to `./data`.
3. Install dependencies, then start the bot in a separate terminal:

   ```bash
   npm install
   npm run bot:dev
   ```

   Use `npm run bot:start` for a non-watching process. Stop either command with `Ctrl+C`.

Open your bot in Telegram, send `/start` or `/help`, then try `Semalam beli ayam RM85 cash dekat Pasar Borong`. Review the draft and use **Confirm** to save it, **Correct** to discard it and send a replacement message, or **Cancel** to discard it. Local files are created on first use at `data/transaction-drafts.json` and `data/transactions.json` (or inside `LOCAL_DATA_DIRECTORY`); delete those generated JSON files to reset local agent data. Voice notes and conversational corrections are deferred to later sessions.

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
