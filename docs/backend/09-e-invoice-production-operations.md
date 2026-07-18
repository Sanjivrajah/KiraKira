# MyInvois v1.0 production operations

The production path hardens the exact-byte unsigned MyInvois v1.0 flow. It does not promote the historical v1.1 signing experiment. NiagaAI currently has no organisation signing certificate, and the production gate therefore requires OAuth credentials and a proven sandbox lifecycle—not certificate material.

Official sources were rechecked on 17 July 2026:

- [MyInvois FAQ](https://sdk.myinvois.hasil.gov.my/faq/) says v1.0 can be submitted without digital-signature validation until HASiL announces retirement.
- [Document types](https://sdk.myinvois.hasil.gov.my/types/) says v1.0 and v1.1 share the structure, signature validation is disabled for v1.0, and v1.0 will be deprecated later.
- [Integration practices](https://sdk.myinvois.hasil.gov.my/integration-practices/) publishes per-client endpoint limits and requires `Retry-After` handling for HTTP 429.
- [Cancel Document](https://sdk.myinvois.hasil.gov.my/einvoicingapi/03-cancel-document/) requires a reason and normally allows cancellation within 72 hours of validation.

## Configuration and activation

Keep all values server-only:

```text
MYINVOIS_SANDBOX_API_BASE_URL=https://preprod-api.myinvois.hasil.gov.my
MYINVOIS_SANDBOX_IDENTITY_BASE_URL=https://preprod-api.myinvois.hasil.gov.my
MYINVOIS_PRODUCTION_API_BASE_URL=https://api.myinvois.hasil.gov.my
MYINVOIS_PRODUCTION_IDENTITY_BASE_URL=https://api.myinvois.hasil.gov.my
EINVOICE_STATUS_SYNC_SECRET=<high-entropy worker secret>
```

Production and sandbox need separate `myinvois_connections` rows and separate environment-scoped secret references. `document_version` is constrained to `1.0`. A production connection is usable only when it is enabled, OAuth-verified, explicitly activated, and not subsequently disabled.

Activation order:

1. Complete a sandbox submission through a reconciled `Valid` or actionable `Invalid` result.
2. As an owner or admin with a sign-in no older than 15 minutes, call `POST /api/e-invoices/operations` with `verify_sandbox` and a meaningful audit reason.
3. Configure and verify the independent production connection and credentials.
4. Call the operations endpoint with `activate_production`, the exact confirmation `ACTIVATE MYINVOIS PRODUCTION`, and a reason.
5. Select Production visibly in `/e-invoices`. Reconfirm the taxpayer identity and every batch before submission.

Emergency disable uses `disable_production` with `DISABLE MYINVOIS PRODUCTION`. It blocks new production submissions without deleting payloads, submissions, statuses, or audit history.

## Worker recovery and reconciliation

The scheduled status worker claims due submissions with a database lease and `FOR UPDATE SKIP LOCKED`, so restarts and concurrent workers do not process the same item simultaneously. Each failed worker attempt uses bounded exponential delay. Twelve failures move the item to `dead_letter`, preserve the reason, and emit an operator event.

Use submission UIDs with Get Submission for normal reconciliation. Use document details only for invalid results. Never use broad Search Documents as the routine recovery mechanism. Inspect dead letters through `GET /api/e-invoices/operations`; investigate the upstream and local identifiers before any operator requeue. Do not create a new submission for a payload that may already have been accepted.

## Cancellation and corrections

Only an owner or admin with recent authentication can cancel. The document must be locally `valid`, have a provider UUID, and still be inside its stored cancellation deadline. The API requires a 10–300 character reason and an exact high-risk confirmation. A successful cancellation appends status and operation events; it never deletes or edits the source invoice or immutable payload.

After the cancellation window, issue the appropriate credit, debit, or refund note. Never destructively rewrite an already submitted document.

## Incident and credential-compromise runbook

1. Disable the production connection immediately through the audited operation.
2. Revoke or rotate the affected MyInvois client secret in server-side secret storage; do not put the replacement in browser assets or database plaintext.
3. Review operation events, submission correlation IDs, UIDs, document UUIDs, and provider records. Avoid logging payloads, tokens, or personal data.
4. Reconcile ambiguous attempts by their stored submission UID before any retry.
5. Verify the replacement OAuth credentials, repeat a controlled sandbox check when the integration changed, then explicitly reactivate production.
6. Record the incident scope, timeline, actor, affected taxpayers/documents, containment, and final outcome in the organisation incident system.

## v1.0 retirement runbook

Monitor the MyInvois FAQ, document-types page, SDK release notes, and official notices. If HASiL publishes a v1.0 retirement date, open a tracked migration decision immediately. Disable production before the effective date unless a tested, certificate-backed successor is ready. The application must never silently relabel a v1.0 payload as v1.1 or submit unsigned content under a signature-validating version.

## Observability and retention

Alert on authentication failures, 401/403/422/429 outcomes, timeout or oversized/malformed responses, acceptance ratios, invalid categories, queue depth, dead letters, reconciliation lag, and time in Submitted/Processing. Use local submission IDs, provider submission UIDs, document UUIDs, and correlation IDs. Do not emit bearer tokens, secret references, raw documents, base64 payloads, or unrestricted provider responses.

Define production retention with Malaysian tax, privacy, and business owners before activation. Immutable payload snapshots, submission/status history, cancellation events, and operator events need a documented backup and restore test. Sandbox data is not a backup.
