# MyInvois UBL fixtures

`internal/` contains canonical NiagaAI domain fixtures. `expected-ubl/` contains checked-in UBL JSON golden files produced by the supported mapper and reviewed as intentional wire-format expectations.

The Stage 3 mapper covers unsigned Invoice v1.0 documents and the normal
credit/debit/refund adjustment type codes. B2B, B2C, consolidated
general-public, tax-exempt, multiple-tax-group, document-discount and
foreign-buyer inputs are covered by contract tests. Self-billed variants remain
explicitly unsupported until their distinct role and scenario rules receive a
dedicated mapper.

Official contract metadata: MyInvois Invoice v1.0 and code-table pages,
retrieved 2026-07-17, mapper version `invoice-v1.0.2`, JSON/UBL 2.1. Source URLs
are pinned in `MYINVOIS_PINNED_REFERENCE_DATA`; fixtures are never fetched at
runtime.

Golden files must be updated only after reviewing the field mapping and documenting the intentional payload change.
