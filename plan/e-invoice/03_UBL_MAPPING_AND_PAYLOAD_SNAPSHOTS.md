# Stage 3: UBL Mapping and Payload Snapshots

## Goal

Implement deterministic MyInvois UBL 2.1 Invoice v1.1 JSON generation from an approved canonical document and persist the exact immutable payload snapshot. This stage does not authenticate, sign, or submit to MyInvois.

## Format decision

Implement JSON first unless an explicit product requirement selects XML. All documents in one MyInvois submission must use one format, so do not mix them in a batch.

## Official contract

Treat these as versioned inputs:

- MyInvois Invoice v1.1 structure.
- UBL 2.1 JSON naming and element ordering requirements.
- MyInvois code lists and validation rules.
- Official sample payloads.
- The Stage 1 field-source matrix.

Record the source URL, retrieval date, supported document type, and version beside fixtures or reference metadata. Do not scrape official pages at runtime.

## Mapper implementation

Add a concrete mapper behind the existing `MyInvoisDocumentMapper` contract, for example:

```text
src/compliance/myinvois/mappers/invoice-v1.1-json.ts
```

The mapper must:

- Accept only approved, validated snapshots.
- Emit the correct Invoice Type Code and `listVersionID`.
- Map supplier and buyer identifiers using the correct schemes.
- Map country/state/address/contact structures.
- Map currency and conditional exchange rate.
- Map invoice lines, classifications, units, prices, taxes, exemptions, discounts, and charges.
- Map grouped tax totals and legal monetary totals.
- Map payment, billing-period, shipping, customs, FTA, tariff, origin, and reference structures when applicable.
- Omit inapplicable optional elements rather than serialising empty placeholders.
- Return structured mapping diagnostics with canonical and UBL paths.

Do not calculate authoritative totals inside the mapper. Totals must already be validated in the canonical document; the mapper translates them.

## Payload snapshot service

Create a service that:

1. Loads one approved e-Invoice revision.
2. Confirms that it has not been superseded.
3. Runs readiness validation again against the pinned reference-data version.
4. Maps the document.
5. Serialises/minifies it deterministically.
6. Computes SHA-256 over the exact unsigned bytes.
7. Persists the payload, format, hash, mapper version, document version, reference-data version, and generation timestamp.

The same approved revision and mapper version must produce byte-identical output.

Use a separate immutable payload-snapshot table or a protected immutable record equivalent to:

```text
e_invoice_payload_snapshots
- id
- business_id
- e_invoice_document_id
- document_revision
- document_version
- mapper_version
- reference_data_version
- format
- unsigned_payload
- unsigned_payload_hash
- generated_at
```

Disallow update and delete through normal application roles. Corrections create new snapshots from new document revisions.

## Reference data

- Replace demo-only assumptions with a versioned reference-data import process or pinned production fixture set.
- Validate invoice type, classification, tax type, payment mode, currency, country, state, unit, and MSIC codes.
- Retain the reference-data version used for every generated payload.
- Fail closed when required reference data is absent or expired.

## Fixture and contract tests

Create golden fixtures for at least:

- Standard Malaysian B2B invoice.
- Taxable invoice.
- Tax-exempt line.
- Foreign-currency buyer/invoice.
- Invoice with discounts and charges.
- Adjustment document with original reference.
- General-public scenario if enabled.

Tests must verify:

- Exact JSON structure and key casing.
- Mandatory and conditional element presence.
- Omission of inapplicable fields.
- Decimal precision and currency attributes.
- Deterministic serialisation and hashes.
- Meaningful diagnostics when a canonical field cannot be mapped.
- Payload size reporting against the 300 KB document limit.

Where possible, validate fixtures with official schemas/examples and later submit them manually in sandbox before enabling automated submission.

## Out of scope

- Digital-signature elements.
- Certificate storage.
- OAuth token acquisition.
- Submit Documents API calls.
- Status polling.

## Deliverables

- Invoice v1.1 JSON mapper.
- Versioned reference-data boundary.
- Immutable payload-snapshot migration and repository.
- Payload generation service.
- Golden fixtures and contract tests.
- Documentation showing canonical-to-UBL mapping ownership.

## Handoff to Stage 4

Stage 4 may start only when an approved invoice produces deterministic, size-checked, schema-aligned unsigned bytes and a reproducible SHA-256 hash without any network call.

