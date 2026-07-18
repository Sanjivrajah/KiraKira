# Sandbox e-Invoice submission and status synchronisation

Stage 5 proves submission with immutable, approved, unsigned MyInvois v1.0 JSON snapshots in the sandbox. Digital signatures are unavailable. Stage 6 adds separately gated production submission and controlled cancellation without changing the payload contract.

## Runtime boundaries

- `POST /api/e-invoices/submissions` is the authenticated owner/admin boundary for v1.0 payload generation, preview, submission, and manual refresh.
- `POST /api/internal/e-invoices/status-sync` is the scheduled-worker boundary. Protect it with `EINVOICE_STATUS_SYNC_SECRET` and invoke it with `Authorization: Bearer <secret>` every few minutes. Each active submission stores its next provider-safe poll time; the worker selects only due work.
- `EInvoiceSubmissionService` reloads every unsigned v1.0 payload snapshot and rechecks tenant, active approval, revision, format, exact-byte hash, count, and request size before creating the local attempt.
- `MyInvoisSubmissionTransport` owns provider URLs and response parsing. OAuth performs at most one controlled refresh after a 401.

The database creates the pending attempt and its document rows atomically through an idempotency key. Only the first caller owns the external call; a concurrent or repeated request receives the existing attempt. Synchronous accepted and rejected documents are recorded independently. History tables are readable through tenant RLS but cannot be updated or deleted by normal application roles; controlled security-definer functions append status events.

HTTP 202 means `Submitted`, never `Valid`. Routine polling uses Get Submission. Get Document Details is called only for documents that have become `Invalid`. Valid share links are stored only when both the provider UUID and long ID exist.

## Server configuration

An enabled taxpayer-system or intermediary connection with client ID and client-secret references is required. Direct taxpayer credentials omit `onbehalfof`; intermediary credentials derive it from the selected business. Certificate and private-key references are not active application fields. Configure:

```text
MYINVOIS_SANDBOX_API_BASE_URL=https://preprod-api.myinvois.hasil.gov.my
MYINVOIS_SANDBOX_IDENTITY_BASE_URL=https://preprod-api.myinvois.hasil.gov.my
MYINVOIS_SANDBOX_CLIENT_ID=<sandbox client id>
MYINVOIS_SANDBOX_CLIENT_SECRET=<active sandbox client secret>
EINVOICE_STATUS_SYNC_SECRET=<high-entropy worker secret>
```

Persist only opaque references for the connection secrets:
`env:sandbox:MYINVOIS_SANDBOX_CLIENT_ID` and
`env:sandbox:MYINVOIS_SANDBOX_CLIENT_SECRET`. Bare variable names from older
connection setup are normalized by the database migration.

Do not prefix these values with `NEXT_PUBLIC_`. Do not log request bodies, unsigned documents, access tokens, or raw secret-provider values.

## Manual sandbox checklist

1. Apply migrations through `20260718010000_e_invoice_sandbox_submission_and_status.sql` and regenerate Supabase types from the applied schema.
2. Configure an enabled sandbox taxpayer or intermediary connection for a non-production test taxpayer and verify OAuth. Set its client secret references to the environment-variable names above; leave signing references empty.
3. Prepare and approve a controlled invoice fixture, then use `Prepare sandbox payload` to generate its immutable unsigned v1.0 JSON snapshot.
4. In `/e-invoices`, confirm the banner says `Sandbox environment`, the represented taxpayer is correct, and the displayed encoded size is below the limit.
5. Submit once, then immediately repeat the same action. Confirm one provider call and one local `e_invoice_submissions` row exist for the idempotency key.
6. Confirm HTTP 202 displays `Submitted`, with the provider submission UID and accepted/rejected outcome for every selected invoice code.
7. Trigger the scheduled endpoint or use `Refresh status`. Confirm `Submitted` progresses to `Valid` or `Invalid` without a browser tab remaining open.
8. For a valid fixture, confirm UUID, long ID, and validation link are persisted. For an invalid fixture, confirm actionable validation details are persisted and no automatic resubmission occurs.
9. Confirm `e_invoice_status_events` contains the transition history and that authenticated application roles cannot update or delete submission history.
10. Inspect application and platform logs for the run. They must not contain unsigned payloads, base64 documents, tokens, or secret references.

The Stage 6 handoff is not met until one controlled sandbox fixture completes this full lifecycle and its identifiers and events are inspected in the applied database.

## Evidence status — 17 July 2026

- Automated v1.0 mapping, exact-byte hashing/base64, idempotency, partial acceptance, retry, polling, cancellation, production-disable, tenant-boundary, audit, and redaction tests pass.
- Typecheck, lint, full Vitest, production build, and diff checks pass in the implementation workspace.
- The linked hosted Supabase project was migrated and verified through `20260718050000_e_invoice_v1_0_document_constraint.sql`; linked database types were regenerated after the schema rollout.
- Sandbox OAuth variable names are configured locally, but no persisted end-to-end B2B submission was executed during this implementation run because a disposable authenticated test account, controlled invoice, and reviewed represented-taxpayer connection were not established for the run.
- Docker was not running, so the additional clean/upgraded local migration matrix and pgTAP/RLS execution remain pending; this did not block the reviewed forward migration on the linked hosted project.

This is an explicit incomplete evidence record, not sandbox certification. Do not call `mark_e_invoice_sandbox_verified` or activate production until the manual checklist above has been completed and reviewed.
