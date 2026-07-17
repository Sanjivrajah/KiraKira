# e-Invoice preparation workspace

`/e-invoices` is the Supabase-backed compliance-preparation surface. It is separate from `/invoices`, which continues to own billing and payment tracking. The browser demo deliberately does not simulate approval or MyInvois submission.

## Data and authority

The browser calls the authenticated `/api/e-invoices` boundary. That boundary derives the caller from the Supabase session, verifies active business membership, and invokes `EInvoicePreparationService` over the Supabase repository. Viewers may read; owners, admins, and accountants may prepare or edit; only owners and admins may approve.

Candidate, preparation, and mutation queries are always scoped by `business_id`. RLS repeats that boundary. Supabase errors never fall back to browser storage.

## Preparation lifecycle

1. An eligible saved invoice is assembled with its current supplier and buyer sources.
2. Assembly diagnostics and `validateMyInvoisReadiness` become one labelled set of NiagaAI internal preparation checks.
3. Document-only fields use the typed preparation registry, which links every input back to the Invoice v1.0 field matrix. Reusable supplier and buyer corrections remain in their source records.
4. Saving a document-only override records the actor and timestamp, rebuilds the canonical document on the server, and refreshes readiness with an optimistic revision check.
5. Approval re-loads the source and re-runs authoritative checks before the database atomically freezes the canonical document, supplier snapshot, buyer snapshot, supplemental values, readiness output, actor, and time.

Approved rows are immutable. Editing creates a new active row linked through `supersedes_document_id`; the prior row remains historical but loses later submission eligibility. Invoice payment status is never changed by this lifecycle.

The Submitted view is read-only and reflects persisted sandbox submission history. Internal preparation success is not official MyInvois validation, acceptance, or submission.

## Unsigned payload generation

An active approved revision can be passed to the server-side Stage 3 payload
service. The service re-runs readiness against pinned reference data, maps unsigned
UBL Invoice v1.0 JSON, checks the 300 KB limit, hashes the exact minified UTF-8
bytes, and stores an immutable payload snapshot. Superseded approvals cannot
generate payloads. See [UBL mapping and payload snapshots](backend/06-e-invoice-ubl-payload-snapshots.md).

## Unsigned payload boundary

Invoice v1.0 is the only active path. Certificate, private-key, signing-service,
and signed-snapshot application interfaces are intentionally absent. OAuth
taxpayer/intermediary credentials remain server-only.

Approved unsigned v1.0 snapshots can be submitted only to the MyInvois sandbox
in Stage 5. The submission surface shows exact encoded size, represented taxpayer,
synchronous accepted/rejected outcomes, and reconciled per-document status.
HTTP 202 remains `Submitted`; it is never presented as official validity. Manual
refresh and the protected scheduled worker share one reconciliation service.
See [sandbox submission and status synchronisation](backend/08-e-invoice-sandbox-submission-status.md).
