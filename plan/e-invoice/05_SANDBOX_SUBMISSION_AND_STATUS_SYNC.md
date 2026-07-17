# Stage 5: Sandbox Submission and Status Synchronisation

## Goal

Submit approved, signed documents to the MyInvois sandbox, persist every synchronous result, and reconcile asynchronous document status without duplicate or cross-tenant submissions.

## Submission service

Build a server-side application service that:

1. Accepts selected approved e-Invoice document IDs for one business.
2. Reloads and authorises every record.
3. Rejects mixed environments, formats, superseded revisions, unsigned payloads, and non-submittable statuses.
4. Enforces a maximum of 100 documents, 5 MB total request size, and 300 KB per document.
5. Builds each API item from the exact signed bytes, base64 document, exact-byte hash, format, and internal code number.
6. Creates a local pending submission with an internal idempotency key before the network call.
7. Calls `POST /api/v1.0/documentsubmissions/`.
8. Stores correlation headers, HTTP status, submission UID, accepted documents, rejected documents, and structured errors.
9. Transitions each document independently; a partially accepted batch must not be treated as wholly successful or failed.

Do not rely on a client-provided readiness flag or hash.

## Persistence

Add records equivalent to:

```text
e_invoice_submissions
- id / business_id / environment
- idempotency_key
- request_hash
- submission_uid
- status
- requested_at / responded_at
- http_status / correlation_id
- retry_count / retry_after
- error_code / error_message / raw_response

e_invoice_submission_documents
- submission_id / e_invoice_document_id
- invoice_code_number
- accepted
- myinvois_uuid
- rejection_error

e_invoice_status_events
- business_id / e_invoice_document_id
- status / source / occurred_at
- submission_id / details / validation_result
```

Protect history from update/delete through normal application roles.

## Idempotency and retries

- Derive idempotency from business, environment, selected signed snapshot IDs, and exact request hash.
- Repeated clicks must return the existing local attempt rather than creating a second call.
- Respect MyInvois `Retry-After` and duplicate-submission behaviour.
- Retry only transport or explicitly retryable failures.
- Do not automatically resubmit documents rejected for structure, permission, or business validation.
- Require a new approved revision after correcting an invalid document.

## Status synchronisation

After a `202` response:

- Poll Get Submission on the server, initially using the recommended 3–5 second interval.
- Apply backoff and a maximum active polling window.
- Persist overall and per-document states.
- Stop polling terminal documents.
- Use Get Document Details only for invalid-document validation details, not routine polling.
- Store MyInvois UUID, long ID, validation results, and valid share/QR URL data where returned.
- Maintain a manual “Refresh status” action that uses the same reconciliation service.

Use a durable job/queue or scheduled worker rather than depending on a browser tab remaining open.

## UI changes

Enable submission on `/e-invoices` only for approved, signed sandbox records.

Show:

- Selected document count and total encoded size.
- Environment banner.
- Final confirmation including represented taxpayer identity.
- Batch progress and immediate accepted/rejected outcomes.
- Per-document Submitted, Processing, Valid, Invalid, Cancelled, or Failed state.
- Detailed corrective feedback for invalid records.
- MyInvois identifiers and validation link only when returned.

Never display “Valid” immediately after HTTP 202.

## Cancellation boundary

Model cancellation eligibility and deadline data now, but implement the actual cancel operation only if included explicitly in this stage's approved scope. It must never be represented as deleting the local invoice.

## Tests

- Submission rejects unapproved, unsigned, superseded, cross-tenant, mixed-format, and mixed-environment documents.
- Size and count limits are enforced before network calls.
- Exact bytes used for hash, base64, and request payload match.
- Double-click and retry scenarios produce one external call.
- Partial acceptance persists independent results.
- 401 performs at most one controlled token refresh.
- 403 permission errors do not retry automatically.
- 422 duplicate and `Retry-After` responses are handled explicitly.
- Polling transitions Submitted -> Valid or Invalid and stops at terminal state.
- Invalid validation details are mapped to useful UI diagnostics.
- Logs never contain documents, tokens, secrets, or private keys by default.

## Deliverables

- Submission and submission-document migrations/repositories.
- MyInvois HTTP transport adapter.
- Idempotent batch submission service.
- Durable status reconciliation worker/service.
- Sandbox submission and status UI.
- Contract tests with mocked MyInvois responses plus a documented manual sandbox checklist.

## Handoff to Stage 6

Stage 6 may start only after at least one controlled sandbox fixture completes the full local lifecycle from approved signed snapshot to reconciled `Valid` or actionable `Invalid`, with all identifiers and events persisted.

