# e-Invoice UBL mapping and payload snapshots

The payload-snapshot service turns one active approved preparation revision into deterministic,
unsigned MyInvois Invoice v1.0 UBL JSON. It does not authenticate or submit,
or claim that MyInvois has accepted the document.

## Ownership boundary

| Concern | Owner |
| --- | --- |
| Supplier, buyer, invoice lines, totals, and approval state | Frozen `e_invoice_documents` revision |
| Applicability and code validity | `validateMyInvoisReadiness` plus the pinned reference catalog |
| Canonical field to UBL element translation | `InvoiceV10Mapper` |
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

## Fixed external contract

The offline catalog version is `myinvois-sdk-2026-07-17`, retrieved on
2026-07-17. It contains 3,854 normalized codes from all nine official JSON
downloads. `npm run data:import:myinvois` is the explicit build-time import
boundary. The import command writes only `*.candidate.json` files and validates
strict source-specific row shapes, non-empty tables, duplicate codes, bounded
HTTPS responses, raw-file SHA-256 checksums, deterministic ordering, and an
aggregate checksum before any later review or promotion step. Runtime code
never scrapes official pages.

Retrieve a disposable candidate, then verify the same candidate without network
access:

```bash
npm run data:import:myinvois -- \
  --version myinvois-sdk-YYYY-MM-DD-candidate \
  --retrieved-at YYYY-MM-DD \
  --output /tmp/myinvois-sdk-YYYY-MM-DD.candidate.json
npm run data:import:myinvois -- \
  --verify /tmp/myinvois-sdk-YYYY-MM-DD.candidate.json
```

The refresh command cannot write a reviewed artifact filename. As observed on
17 July 2026, the official MSIC download repeats code `16211` twice with the
same description and category. The hardened importer rejects that duplicate
instead of silently collapsing it, so the checked-in 17 July catalog remains
the last known good runtime artifact pending an upstream correction and the
required semantic review and promotion.

Primary references:

- [MyInvois Invoice v1.0](https://sdk.myinvois.hasil.gov.my/documents/invoice-v1-0/)
- [MyInvois document types](https://sdk.myinvois.hasil.gov.my/types/)
- [MyInvois code tables](https://sdk.myinvois.hasil.gov.my/codes/)
- [MyInvois sample payload index](https://sdk.myinvois.hasil.gov.my/sample/)

The checked-in reference boundary and golden fixtures must be reviewed and
versioned together when official guidance changes. A mapper change also
requires a new mapper version so older hashes remain reproducible.

## Downstream handoff

The submission service consumes the exact v1.0 `unsigned_payload` and `unsigned_payload_hash`
as immutable inputs. Historical v1.1 or signed rows cannot enter this path.
