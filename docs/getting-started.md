# Getting started

## Prerequisites

- Node.js 22—the version declared in `package.json`
- npm
- Docker Desktop for local Supabase
- A Telegram bot token only if you are running the bot
- OpenAI and ElevenLabs credentials only for the capture paths that call those providers

## Install

```bash
npm install
cp .env.example .env.local
```

Do not commit `.env.local`. The checked-in `.env.example` contains names and safe defaults only.

## Choose a persistence mode

### Browser-local demo

Use this when working on the interface without Supabase:

```text
NEXT_PUBLIC_AUTH_MODE=demo
```

Start the web app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The seeded demo account is:

```text
Email: lina@niagaai.demo
Password: demo1234
```

The password exists to exercise the form flow—it is not compared with a server-side credential. Records stay in the current browser. Clearing site data or using the demo reset removes them.

### Local Supabase

Start and rebuild the local stack:

```bash
npm run supabase:start
npm run supabase:reset
npm run supabase:status -o env
```

Copy the API URL and publishable or anon key from the status output into `.env.local`:

```text
NEXT_PUBLIC_AUTH_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local publishable key>
```

Then start Next.js:

```bash
npm run dev
```

`supabase/migrations` is the schema source of truth. A local reset destroys local database data and reapplies every migration—never point a reset command at a hosted project.

Useful local Supabase commands:

```bash
npm run supabase:status
npm run supabase:stop
npx supabase gen types typescript --local > src/lib/supabase/database.types.ts
npx supabase test db
```

## Enable extraction and voice features

Add only the credentials needed for the path you are testing:

```text
OPENAI_API_KEY=<server key>
ELEVENLABS_API_KEY=<server key>
ELEVENLABS_AGENT_ID=<private conversational agent id>
```

The model variables in `.env.example` already carry development defaults. Receipt and bank-statement extraction need OpenAI. Transaction voice notes need ElevenLabs transcription and OpenAI structuring. The live `/voice` assistant needs both `ELEVENLABS_API_KEY` and `ELEVENLABS_AGENT_ID`.

Provider secrets are read by server routes—never add `NEXT_PUBLIC_` to them.

## Run the Telegram worker

Create a bot with BotFather, then add:

```text
TELEGRAM_BOT_TOKEN=<bot token>
OPENAI_API_KEY=<server key>
OPENAI_TRANSACTION_MODEL=gpt-4o-mini
ELEVENLABS_API_KEY=<server key>
```

For a self-contained local demo:

```text
BOT_PERSISTENCE_MODE=local
LOCAL_DATA_DIRECTORY=./data
```

For the Supabase-backed path, use:

```text
BOT_PERSISTENCE_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=<local or hosted project URL>
SUPABASE_SERVICE_ROLE_KEY=<server-only service-role key>
```

Run the worker in another terminal:

```bash
npm run bot:dev
```

Supabase mode requires the Telegram user to generate a link code under Settings in the web app, then send `/link <code>` in a private chat. The worker rejects unlinked or inactive memberships.

## Run the checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
```

For migration changes, start from a clean local database and also run:

```bash
npx supabase db reset
npx supabase test db
npx supabase gen types typescript --local > src/lib/supabase/database.types.ts
git diff --exit-code -- src/lib/supabase/database.types.ts
```

## Common problems

| Symptom | Check |
| --- | --- |
| The app says Supabase configuration is missing | Set both public Supabase values, or explicitly use demo mode |
| Supabase CLI cannot start | Start Docker Desktop and check for occupied local ports |
| The bot exits before polling | Check the four required bot/provider values and the selected persistence mode |
| The bot says the account must be linked | Generate a fresh web link code and use it in a private Telegram chat |
| Receipt or statement extraction returns 503 | Configure `OPENAI_API_KEY` and the relevant model value |
| Voice assistant returns 503 | Configure both ElevenLabs values used by `/api/voice/session` |
| Hosted schema and generated types disagree | Verify the linked project, migration list, and regenerate types from that schema |

See [configuration.md](configuration.md) for the complete variable matrix and [supabase-operations.md](supabase-operations.md) for hosted migration work.
