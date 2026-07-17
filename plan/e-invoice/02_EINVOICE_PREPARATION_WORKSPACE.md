# Stage 2: E-Invoice Preparation Workspace

## Goal

Add an `/e-invoices` workspace where authorised users select eligible saved invoices, resolve missing or conditional information, run readiness checks, and approve immutable document revisions. No live MyInvois submission occurs in this stage.

## UX structure

Provide these views:

- `Needs information`: preparation records with blocking local errors.
- `Ready for approval`: complete records that pass current internal rules.
- `Approved`: frozen revisions awaiting later payload generation or submission.
- `Submitted`: visible placeholder or read-only view only if historical records already exist; do not simulate submissions.

The invoice page remains responsible for billing and payment tracking. The e-Invoice page owns compliance preparation.

## Candidate selection

List saved invoices that:

- Belong to the active business.
- Are not void or cancelled.
- Have not already produced a final active e-Invoice for the same source revision.
- Contain enough source information to begin preparation.

Support checkbox selection and batch preparation. Selection does not mean the record is ready to submit.

Show why an invoice is ineligible rather than hiding it without explanation.

## Additional-fields design

Build from the Stage 1 field-source matrix. Each field definition must include:

- Stable key and canonical destination path.
- Label and help text.
- Data type and validation schema.
- Cardinality.
- Applicability predicate.
- Scope: business, buyer, document, or line.
- Whether it is derived, reusable, or document-specific.
- Official reference label.

Do not expose an arbitrary JSON editor as the primary UX.

Examples of conditional sections:

- Foreign currency and exchange rate.
- Billing period and frequency.
- Shipping recipient.
- Tax exemption details.
- Prepayment.
- Customs import/export references.
- FTA and certified-exporter information.
- Product tariff and origin metadata.
- Additional document-level charges.

Persistent corrections should route users appropriately:

- Supplier issue -> business settings.
- Buyer issue -> customer record.
- Invoice or line issue -> document preparation editor.

Allow an explicit document-only override where audit requirements permit it. Preserve who entered the override and when.

## Readiness and approval

- Reuse `validateMyInvoisReadiness` for immediate feedback.
- Run the authoritative validation on the server before approval.
- Group diagnostics by supplier, buyer, document, line, tax, and scenario.
- Distinguish error, warning, derived value, and optional recommendation.
- Never label internal checks as official MyInvois validation.
- Disable approval while any blocking error remains.
- Approval freezes supplier, buyer, canonical document, supplemental values, readiness output, actor, and timestamp as one revision.
- Editing an approved record creates a new revision and revokes the previous revision's submission eligibility; it must not mutate history.

## Scenario handling

Support individual B2B invoices first. Keep these paths explicit even if their detailed UI is staged behind feature flags:

- General Public / consolidated transaction.
- Foreign buyer.
- Self-billed documents.
- Credit, debit, and refund notes with original-document references.

Do not treat “combine data from several schemas” as a consolidated e-Invoice. Data assembly and the official consolidated-transaction scenario are separate concepts.

## Accessibility and usability

- Keyboard-accessible selection and field navigation.
- Summary counts for selected, needs-information, ready, and approved records.
- Fix links focus the correct section or route.
- Mobile layout must keep approval status and blockers readable.
- Preserve entered values when server validation returns errors.
- Confirm before discarding an edited preparation revision.

## Out of scope

- UBL payload generation.
- Certificates and digital signing.
- Authentication with MyInvois.
- Submission buttons that call external APIs.
- Automated status polling.

## Tests

- Candidate query excludes void, cancelled, cross-tenant, and already-finalized sources.
- Batch preparation creates one idempotent preparation per source revision.
- Conditional fields appear only when their predicates apply.
- Supplier and buyer fixes route to the correct source record.
- Server validation rejects approval when browser state is stale or incomplete.
- Approval records actor, time, revision, and frozen snapshots.
- Editing after approval creates a new revision.
- UI copy always says internal preparation checks, not official validation.

## Deliverables

- `/e-invoices` route and navigation entry.
- Candidate list, selection, preparation editor, readiness summary, and approval flow.
- Typed field-definition registry backed by the Stage 1 matrix.
- Query and mutation hooks over repository/application services.
- Focused component, service, accessibility, and tenant-isolation tests.

## Handoff to Stage 3

Stage 3 may start only when an approved preparation revision is immutable, fully schema-valid, reproducible from storage, and contains every value required for its selected scenario.

