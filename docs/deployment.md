# Deployment

The deployed system uses Vercel for the Next.js application, Railway for the Telegram polling worker, and Supabase for Auth, PostgreSQL, RLS, RPCs, and private object storage.

## Responsibility map

| Platform | Owns | Does not own |
| --- | --- | --- |
| Vercel | Pages, server rendering, Route Handlers, extraction endpoints, voice tokens, MyInvois operations | Persistent bot process or the primary database |
| Railway | One long-running Telegram worker using `npm run bot:start` | Web pages, webhooks, or a public HTTP service |
| Supabase | Authentication, tenant-scoped data, database functions, migrations, audit history, private storage | OpenAI, ElevenLabs, Telegram, or MyInvois credentials |

## Release order

For changes that span schema and applications, release in this order:

1. Review the hosted Supabase project, backup state, and migration list.
2. Apply backward-compatible migrations and regenerate `database.types.ts`.
3. Deploy the Vercel application and verify browser and server routes.
4. Deploy or restart the Railway worker after the required schema is available.
5. Run end-to-end checks with disposable accounts and synthetic records.
6. Enable any newly introduced scheduled or high-risk operation only after the normal path is healthy.

Database changes should follow expand, migrate, then contract. Do not deploy an application that needs a column or function before the compatible migration is present.

## Vercel web application

Create a Vercel project from this repository. The repository does not need a custom `vercel.json` for the web build—Vercel can detect Next.js and use the standard `npm run build` command. The runtime contract in `package.json` is Node.js 22.

Configure at minimum:

```text
NEXT_PUBLIC_AUTH_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=<hosted Supabase URL>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>
```

Add provider and MyInvois values only for enabled features. `SUPABASE_SERVICE_ROLE_KEY` is also required on Vercel when a trusted server route—such as scheduled e-Invoice reconciliation—uses the admin client.

After the first production domain exists:

- set the Supabase Auth site URL to the canonical Vercel or custom domain;
- add exact preview or callback URLs that are intentionally supported;
- keep production and preview Supabase projects separate when preview writes must not touch production data;
- verify that `/api/health/supabase` returns 404 in production—it is intentionally a development health route.

## Railway Telegram worker

Create one Railway service from the same repository. `railway.toml` selects Railpack and defines:

```text
startCommand = "npm run bot:start"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

Configure the Railway service with:

```text
TELEGRAM_BOT_TOKEN=<BotFather token>
BOT_PERSISTENCE_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=<hosted Supabase URL>
SUPABASE_SERVICE_ROLE_KEY=<server-only service-role key>
OPENAI_API_KEY=<server key>
OPENAI_TRANSACTION_MODEL=gpt-4o-mini
ELEVENLABS_API_KEY=<server key>
ELEVENLABS_STT_MODEL=scribe_v2
MAX_VOICE_FILE_BYTES=20971520
```

No Railway domain or health port is required—the worker opens outbound connections to Telegram, Supabase, OpenAI, and ElevenLabs. Run a single polling replica unless the update-consumption strategy is changed and tested for multiple workers.

The deployment is healthy when the log reports that NiagaAI is polling, `/start` responds, an authenticated user can link a private chat, and one reviewed transaction appears in the correct Supabase business without a duplicate.

## Hosted Supabase

Follow [supabase-operations.md](supabase-operations.md) for linking and migration commands. Before application deployment, verify:

- every migration is present in order;
- generated TypeScript types match the hosted schema;
- Auth site and redirect URLs match the Vercel environments;
- RLS and database tests pass from a clean local rebuild;
- the private evidence bucket and policies exist if evidence upload is enabled;
- backups or PITR match the environment’s recovery requirements;
- production has no automatic demo seed.

The service-role key belongs only in Vercel and Railway server environments. It must never be used in browser code or stored in Supabase tables.

## Scheduled e-Invoice status sync

`POST /api/internal/e-invoices/status-sync` reconciles due MyInvois submissions. It requires:

```http
Authorization: Bearer <EINVOICE_STATUS_SYNC_SECRET>
```

No scheduler is checked into this repository. Configure a Vercel Cron job or another trusted scheduler to call the deployed Vercel URL every few minutes, and store the same bearer secret on both sides. Do not call the endpoint from a browser. Monitor processed counts, failures, retry age, and dead letters.

## Post-deployment smoke test

1. Create a disposable Supabase user and business through the Vercel app.
2. Confirm a second account cannot read that business.
3. Create, edit, and void a transaction; refresh and confirm persistence.
4. Create and issue an invoice, then check reminders and dashboard totals.
5. Exercise one configured receipt or voice path without logging raw evidence.
6. Generate a Telegram link code, link a private chat, confirm one transaction, and use undo.
7. If MyInvois is enabled, verify the sandbox identity and complete the sandbox checklist before any production activation.
8. Inspect Vercel, Railway, and Supabase logs for safe identifiers only—no secrets, payloads, or transcripts.

## Rollback and incidents

Vercel and Railway application code can be rolled back to a known-compatible deployment. Database rollback should normally be a reviewed forward-fix migration; do not edit or remove an applied migration. If data recovery is required, stop writes and follow the backup owner’s restore procedure.

For a leaked key, revoke or rotate it at Supabase, Telegram, OpenAI, ElevenLabs, or MyInvois first. Update the affected platform environment, redeploy or restart, review access logs, and record the affected time window. MyInvois production can also be disabled through its audited operations gate without deleting submission history.
