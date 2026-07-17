# e-Invoice preparation workspace

`/e-invoices` is the Supabase-backed compliance-preparation surface. It is separate from `/invoices`, which continues to own billing and payment tracking. The browser demo deliberately does not simulate approval or MyInvois submission.

## Data and authority

The browser calls the authenticated `/api/e-invoices` boundary. That boundary derives the caller from the Supabase session, verifies active business membership, and invokes `EInvoicePreparationService` over the Supabase repository. Viewers may read; owners, admins, and accountants may prepare or edit; only owners and admins may approve.

Candidate, preparation, and mutation queries are always scoped by `business_id`. RLS repeats that boundary. Supabase errors never fall back to browser storage.

## Preparation lifecycle

1. An eligible saved invoice is assembled with its current supplier and buyer sources.
2. Assembly diagnostics and `validateMyInvoisReadiness` become one labelled set of NiagaAI internal preparation checks.
3. Document-only fields use the typed preparation registry, which links every input back to the Stage 1 Invoice v1.1 field matrix. Reusable supplier and buyer corrections remain in their source records.
4. Saving a document-only override records the actor and timestamp, rebuilds the canonical document on the server, and refreshes readiness with an optimistic revision check.
5. Approval re-loads the source and re-runs authoritative checks before the database atomically freezes the canonical document, supplier snapshot, buyer snapshot, supplemental values, readiness output, actor, and time.

Approved rows are immutable. Editing creates a new active row linked through `supersedes_document_id`; the prior row remains historical but loses later submission eligibility. Invoice payment status is never changed by this lifecycle.

The Submitted view is intentionally read-only and empty until a later roadmap stage creates real submission history. Internal preparation success is not official MyInvois validation, acceptance, or submission.

