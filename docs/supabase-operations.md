# Supabase operations runbook

This runbook covers local and hosted database operations. SQL in
`supabase/migrations/` is the only schema source of truth—never repair a
hosted schema by editing the dashboard or an already-applied migration.

## Local verification

Docker Desktop must be running. From a clean local database, run:

```bash
npx supabase stop --no-backup
npx supabase start
npx supabase db reset
npx supabase gen types typescript --local > src/lib/supabase/database.types.ts
npm run lint
npm run typecheck
npm test
npm run build
```

Also run `npx supabase test db` for the database/RLS suite when the installed
CLI supports it. The GitHub Actions workflow performs the same clean rebuild;
it uses local containers only and receives no hosted service-role credential.

## Explicit data imports

Browser-local records are never uploaded automatically. A developer can export
transactions from **Settings → Development data export**, then, while signed
in to the target business, POST the JSON file to
`/api/data-migrations/browser-local` with `mode: "preview"` before a separate
`mode: "commit"` request. The payload requires schema version 1, a UUID export
batch ID, and records. The target user must have an active owner, admin,
accountant, or staff membership. Per-record errors are returned without
creating rows. A committed batch is recorded in `data_import_batches`; reruns
skip matching `external_key` values.

Telegram JSON records require an explicit mapping file—no account is inferred
from a Telegram user ID:

```json
[{"telegramUserId":"123","telegramChatId":"123","telegramAccountId":"<linked-account-uuid>"}]
```

Preview before writing, then keep the automatically-created source backup:

```bash
npm run data:import:telegram -- --input data/transactions.json --links ./telegram-links.json --dry-run
npm run data:import:telegram -- --input data/transactions.json --links ./telegram-links.json --commit --batch-id <new-uuid>
```

The commit requires server-only `SUPABASE_SERVICE_ROLE_KEY`, validates the
mapped account and its active business membership for each row, and reports
individual failures. It imports only confirmed/voided records and keeps the
original source ID in migration metadata and the deterministic external key.

## Hosted Supabase

The human release owner must create/select the intended hosted project and
authenticate the CLI. Do not put any hosted secret in this repository.

```bash
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
npx supabase migration list
npx supabase db push --help
npx supabase db push --dry-run
# Review every listed migration, project ref, organization, and backup state.
npx supabase db push
npx supabase migration list
npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts
npm run typecheck
```

Before the push, take a backup if the target is non-empty and reconcile any
dashboard-created drift with supported pull/diff commands. Confirm the project
name, ref, and organization out of band. Configure site/redirect URLs, auth
providers and email templates, private storage policies, production browser
keys, server-only service-role key, rate limits, SMTP (if used), logs/alerts,
and an appropriate backup/PITR policy. Never seed production automatically.

After deployment, use disposable test accounts to verify sign-in, onboarding,
transactions, evidence upload/review, invoice/payment/reminder flows, Telegram
link/text/voice flows, cross-business denial, private-object denial, and audit
history. Clean test data only through approved admin/test procedures.

## Rollback and incidents

Use additive expand/migrate/contract changes. Do not drop a column/table in the
same deployment as a cutover; preserve old structures until imported data is
verified. Never edit an applied migration. For unsafe rollback, ship a reviewed
forward-fix migration and restore from the pre-deployment backup only under the
incident owner’s direction.

For a bad migration: stop further pushes, capture migration list and logs,
assess data impact, restore or forward-fix using reviewed SQL, then rerun the
smoke checks. For a leaked publishable/service-role/API key: revoke/rotate it
in Supabase or its provider immediately, replace deployment secrets, restart
affected services, inspect audit/access logs, and document the incident. The
service-role key is server-only; it must never be a `NEXT_PUBLIC_` value.
