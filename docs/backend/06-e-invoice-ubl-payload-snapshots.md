# e-Invoice UBL mapping and payload snapshots

Stage 3 turns one active approved preparation revision into deterministic,
unsigned MyInvois Invoice UBL JSON. v1.1 remains reproducible, while Stage 5
requests v1.0 for unsigned sandbox submission. It does not authenticate, sign, submit,
or claim that MyInvois has accepted the document.

## Ownership boundary

| Concern | Owner |
| --- | --- |
| Supplier, buyer, invoice lines, totals, and approval state | Frozen `e_invoice_documents` revision |
| Applicability and code validity | `validateMyInvoisReadiness` plus the pinned reference catalog |
| Canonical field to UBL element translation | Version-selected `InvoiceV10Mapper` or `InvoiceV11Mapper` |
| Stable key order and minified UTF-8 bytes | `canonicalSerializeMyInvoisPayload` |
| SHA-256, 300 KB check, and idempotent generation | `GenerateEInvoicePayloadSnapshotService` |
| Exact unsigned bytes and generation metadata | `e_invoice_payload_snapshots` |

The mapper translates already-reconciled values. It does not calculate
authoritative totals. Mapping failures identify both the canonical source path
and intended UBL destination path.

## Generation rules

Generation loads the document by `business_id`, and accepts it only when it is
approved, active, and submission-eligible. It re-runs readiness using the
reference-data version pinned in code before mapping. A superseded preparation
cannot generate another snapshot.

The exact minified payload is stored as `text`, not `jsonb`, because JSONB does
not preserve the byte representation that was hashed. The table records the
document revision/version, mapper version, reference-data version, format,
byte size, hash, and generation time. Its unique generation key makes retries
return the existing snapshot. Authenticated application roles have no update,
delete, or truncate permission; corrections require a new approved preparation
revision and a new payload snapshot.

## Versioned external contract

The offline catalog version is `myinvois-sdk-2026-07-17`, retrieved on
2026-07-17. It contains 3,854 normalized codes from all nine official JSON
downloads. `npm run data:import:myinvois` is the explicit build-time import
boundary; it validates non-empty tables, field shapes, and conflicting codes
before writing a versioned artifact. Generation fails closed if a required code
set is absent or the catalog is expired. Runtime code never scrapes official
pages.

Primary references:

- [MyInvois Invoice v1.1](https://sdk.myinvois.hasil.gov.my/documents/invoice-v1-1/)
- [MyInvois document types](https://sdk.myinvois.hasil.gov.my/types/)
- [MyInvois code tables](https://sdk.myinvois.hasil.gov.my/codes/)
- [MyInvois sample payload index](https://sdk.myinvois.hasil.gov.my/sample/)

The checked-in reference boundary and golden fixtures must be reviewed and
versioned together when official guidance changes. A mapper change also
requires a new mapper version so older hashes remain reproducible.

## Downstream handoff

Stage 5 consumes the exact v1.0 `unsigned_payload` and `unsigned_payload_hash`
as immutable inputs. The optional signing boundary may consume v1.1 snapshots
later, but it must never overwrite an unsigned snapshot.
