# E-Invoice persistence and assembly

Stage 1 introduces a Supabase preparation boundary for unsigned Invoice v1.0. It does not generate UBL or contact MyInvois.

## Ownership

- `businesses`, `business_tax_identifiers`, `business_registration_identifiers`, `business_addresses`, and `business_contacts` own the live supplier profile.
- `parties` and its identifier and address child tables own live buyers and shipping recipients.
- `invoices` and `invoice_items` own payment-oriented source records plus the compliance fields captured with a draft.
- `e_invoice_documents` owns a tenant-scoped preparation revision. It stores the canonical document when assembly succeeds, exact supplier and buyer snapshots, supplemental fields, provenance, and readiness diagnostics.
- `src/compliance/myinvois/field-registry.ts` and `plan/e-invoice/REFERENCE_INVOICE_V1_0_FIELD_REQUIREMENTS.md` are the field-coverage contract. The registry records known gaps without supplying placeholder values.

## Assembly boundary

`AssembleEInvoiceDocumentService` loads one invoice through `EInvoiceSourceRepository`, converts integer minor units to canonical decimal strings, reconstructs line calculations, validates parties and the `CommercialDocument` schema, and records field-level provenance. Missing issue time, identifiers, addresses, classifications, or other source values produce diagnostics; the service does not invent `NA`, tax codes, addresses, or timestamps.

The result is persisted through `EInvoicePreparationRepository` as either:

- `ready`, with a schema-valid canonical document and complete snapshots; or
- `needs_information`, with a null canonical document and precise diagnostics.

The source invoice payment status is never changed by preparation.

## Revisions and immutability

The unique `(business_id, source_invoice_id, source_invoice_revision)` key makes preparation idempotent for one source revision. Supplemental fields use an expected revision and reject stale writes. Only a current `ready` revision can be approved. Approval records the actor and timestamp; an approved preparation row, including its supplier and buyer snapshots, cannot be updated.

RLS derives reads from active business membership. Owners, admins, and accountants may prepare or update records; approval is limited to owners and admins. The Supabase adapter has no browser-local fallback.

## Stage boundary

Stage 2 can consume `EInvoicePreparationRecord`. It must not begin submission work unless Stage 1 returns either a complete `CommercialDocument` or explicit missing-field diagnostics. UBL mapping, credentials, submission, polling, cancellation, and an `/e-invoices` UI remain out of scope.
