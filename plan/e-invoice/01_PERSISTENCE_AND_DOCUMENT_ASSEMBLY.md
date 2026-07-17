# Stage 1: Persistence and Document Assembly

## Goal

Make Supabase capable of reconstructing and freezing a complete tenant-scoped `CommercialDocument` from saved application records. This stage repairs the data boundary only; it does not add the e-Invoice page or call MyInvois.

## Why this stage comes first

The invoice builder currently creates rich compliance data in memory, but the live invoice adapter reduces it to a payment-oriented DTO. Important supplier, buyer, timing, payment, reference, shipping, and conditional fields are lost after save. A submission UI built on that representation would be unreliable.

## In scope

### 1. Inventory and field-source matrix

Start from `REFERENCE_INVOICE_V1_0_FIELD_REQUIREMENTS.md`; do not rediscover or replace its verified requirement classifications. Convert it into a typed registry or equivalent implementation source of truth covering each supported Invoice v1.0 field:

- Internal canonical path.
- Official UBL path.
- Mandatory, optional, or conditional status.
- Applicability condition.
- Source of truth: business, party, invoice, invoice line, calculated, or supplemental.
- Persistence location.
- Current availability and gap.
- Official source version and verification date.

The typed registry and the verified reference are the contract for later UI and mapper stages. Add a coverage test proving all 55 guideline fields, SDK expansions, and enabled annexure fields are represented. Do not use an untyped list of 55 labels as the source of truth.

### 2. Supplier identity persistence

Persist and load the supplier information required by the existing compliance model:

- TIN.
- Registration scheme and value.
- SST and tourism-tax registrations where relevant.
- MSIC code.
- Business activity description.
- Primary address.
- Primary email and phone.

Prefer normalized identifier records or an existing compatible table rather than adding unrelated nullable columns repeatedly. Update the business context service so it no longer returns `tin: null` and `registrationNumber: null` when records exist.

### 3. Complete buyer persistence and snapshots

Confirm the party tables and repository preserve:

- Party kind.
- Legal and trading names.
- TIN.
- Registration scheme and value.
- Billing and shipping addresses.
- Phone and email.
- Issuing country.

When an e-Invoice document is prepared, copy the full buyer and supplier shapes into immutable snapshots. Do not depend on mutable party rows after approval.

### 4. E-Invoice persistence model

Add migrations and generated types for records equivalent to:

```text
e_invoice_documents
- id
- business_id
- source_invoice_id
- document_type
- document_version
- scenario
- canonical_document jsonb
- supplier_snapshot jsonb
- buyer_snapshot jsonb
- supplemental_fields jsonb
- readiness_result jsonb
- status
- revision
- approved_at / approved_by
- created_at / updated_at
```

Initial statuses should cover `needs_information`, `ready`, and `approved`. Submission statuses are introduced later and must remain separate from payment statuses.

Add an explicit source link and uniqueness/idempotency rule so repeated preparation cannot silently create duplicate active documents for one invoice revision.

### 5. Assembly service

Create a server-safe application service that:

1. Loads the source invoice and items for one business.
2. Loads the supplier and buyer records.
3. Maps stored minor-unit amounts into canonical decimal-string money values.
4. Restores issue time, payment instructions, references, tax treatments, and line metadata where available.
5. Applies no invented compliance values.
6. Produces a schema-validated `CommercialDocument` plus provenance metadata.
7. Reports missing source data instead of silently substituting placeholders.

Keep database-row mapping outside React components.

### 6. Repository and RLS boundaries

Add repository contracts for:

- Listing e-Invoice candidate source invoices.
- Creating or refreshing a preparation document.
- Loading a preparation document by business and ID.
- Saving supplemental fields with optimistic version checks.
- Approving a ready revision.

Add RLS policies using active business membership. Viewer roles may read; only explicitly authorised roles may modify or approve.

## Out of scope

- `/e-invoices` UI.
- UBL JSON/XML generation.
- Digital signatures.
- MyInvois credentials or API calls.
- Polling and cancellation.
- Turning arbitrary raw transactions into consolidated e-Invoices.

## Tests

- Round-trip a complete B2B invoice through Supabase rows and the assembler.
- Verify supplier and buyer snapshots retain all identifiers and address fields.
- Verify missing data produces explicit diagnostics.
- Verify two businesses cannot read or update each other's preparation documents.
- Verify optimistic concurrency rejects stale supplemental-field writes.
- Verify source invoice payment status remains unchanged.
- Verify no browser-local fallback occurs in Supabase mode.

## Deliverables

- Field-source matrix.
- Supabase migration and regenerated database types.
- Supplier and buyer repository updates.
- E-Invoice repository contract and Supabase adapter.
- Document assembly service with focused tests.
- Short persistence documentation describing ownership and immutability.

## Handoff to Stage 2

Stage 2 may start only when a saved Supabase invoice can be assembled into either:

- A complete, schema-valid `CommercialDocument`; or
- A preparation record with precise missing-field diagnostics and no fabricated values.
