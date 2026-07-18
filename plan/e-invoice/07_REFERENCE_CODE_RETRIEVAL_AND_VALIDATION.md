# Stage 7: MyInvois Reference-Code Retrieval and Validation

## Goal

Make the official MyInvois code tables the controlled source for e-Invoice data entry, preparation validation, and payload generation. Users should choose a labelled option while Niaga persists and submits the official code value. Reference updates must be reviewable, versioned, reproducible, and unable to silently change an approved payload.

This is a post-sandbox corrective stage. Production activation remains blocked until the standard Malaysian B2B path rejects invalid or contextually disallowed codes before approval.

## Existing baseline

The repository already contains most of the immutable reference-data foundation:

- `scripts/import-myinvois-reference-data.mjs` downloads the nine official JSON files.
- `npm run data:import:myinvois` exposes the importer.
- `src/compliance/myinvois/reference-data/fixtures/official/myinvois-sdk-2026-07-17.json` pins the reviewed artifact.
- `MyInvoisReferenceCatalog` supports lookup, active-date checks, required-set checks, and version metadata.
- Payload snapshots already record `referenceDataVersion`.

Stage 7 hardens this baseline and connects it to source-record forms and approval rules. It must not replace pinned payload behavior with live upstream lookups.

## Official code-table scope

Retrieve and manage every table published under the MyInvois SDK code catalog:

| Niaga code set | Official file | Primary consumers |
|---|---|---|
| `classification` | `ClassificationCodes.json` | Invoice line classification |
| `country` | `CountryCodes.json` | Addresses and country of origin |
| `currency` | `CurrencyCodes.json` | Business and document currencies |
| `invoice_type` | `EInvoiceTypes.json` | Document-type mapping and eligibility |
| `msic` | `MSICSubCategoryCodes.json` | Supplier compliance profile |
| `payment_mode` | `PaymentMethods.json` | Payment instructions |
| `state` | `StateCodes.json` | Malaysian supplier, buyer, and shipping addresses |
| `tax_type` | `TaxTypes.json` | Line and document tax groups |
| `unit_of_measurement` | `UnitTypes.json` | Invoice line quantity units |

The table catalog is not a substitute for MyInvois taxpayer operations. TIN search and TIN/registration validation remain a separate authenticated integration because their answers are taxpayer-specific and environment-dependent.

## Target architecture

```text
Official MyInvois JSON files
          |
          v
Bounded refresh command -> raw validation -> normalized candidate artifact
          |                                      |
          |                                      v
          +------------------------------> reviewed semantic diff
                                                 |
                                                 v
                                      immutable pinned catalog
                                                 |
                         +-----------------------+-----------------------+
                         |                       |                       |
                         v                       v                       v
                  server code-query DTOs   readiness rules      payload snapshot
                         |                       |                pins version
                         v                       v
                  labelled selectors      fail-closed approval
                  persist code only
```

Live page requests must never scrape the SDK website or depend on its availability. The last reviewed artifact remains usable until an explicit expiry or production-disable policy says otherwise.

## Work package 1: Harden the refresh command

Extend the existing importer instead of creating another downloader.

- Keep one explicit source registry for the nine code sets and official URLs.
- Add per-request timeouts, redirect limits, response-size limits, content-type checks, and clear source-specific errors.
- Validate each upstream table with a source-specific Zod schema before normalization.
- Reject empty tables, duplicate codes, conflicting descriptions, malformed rows, and unexpected top-level structures.
- Write to a candidate file atomically; never overwrite the reviewed artifact directly.
- Record schema version, retrieval timestamp, source URLs, per-file SHA-256, row counts, and aggregate SHA-256.
- Make output deterministic: stable code-set order, stable code order, normalized whitespace, and a final newline.
- Support an offline verification mode that validates an existing candidate without network access.
- Never print credentials, customer data, or document payloads. These public downloads require no MyInvois OAuth token.

## Work package 2: Add a mandatory semantic diff and review gate

Create a comparison command for the current reviewed artifact and a new candidate.

The report must identify:

- Added and removed codes.
- Description changes.
- Duplicate or reordered source rows.
- Per-table and total row-count changes.
- Source URL or checksum changes.
- Required codes that disappeared, including active codes referenced by current fixtures and mappings.

Rules:

- Additions may pass automated structure checks but still require review.
- Removals, code changes, large count changes, or missing required sets fail the refresh gate.
- A description change is visible in the review report even when the code remains stable.
- Promotion creates a new immutable version such as `myinvois-sdk-YYYY-MM-DD`; old artifacts remain available while payload snapshots reference them.
- Code-table diffs cannot silently introduce business-policy changes. Release-note rules, such as restricted use of state code `17`, live in a separately reviewed policy registry.

## Work package 3: Provide a server-owned reference catalog

Keep the full catalog out of the browser bundle, especially the large MSIC and unit tables.

- Add a server-only query service over the pinned catalog.
- Return minimal DTOs: `code`, `description`, `codeSet`, and catalog `version`.
- Support exact lookup and bounded search/pagination for large sets.
- Authenticate and authorize the application endpoint even though the source tables are public; the route is still an application boundary.
- Cache by immutable catalog version and code-set name.
- Do not allow clients to select or override a reference-data version.
- Expose catalog health metadata to operators: current version, retrieved date, checksums, and last successful verification.

## Work package 4: Replace free-text code fields with controlled selectors

Use labelled, keyboard-accessible selectors that persist only the code.

- State: show `10 — Selangor`, persist `10`.
- Country: show the country name and bridge the domain's ISO alpha-2 value to MyInvois alpha-3 through a complete pinned mapping; remove the mapper's small hard-coded alias list.
- MSIC, classification, and unit: use searchable, virtualized or paginated comboboxes.
- Currency, payment mode, tax type, and document type: use bounded selects where practical.
- Show the saved code and description on detail/review screens.
- Preserve a useful loading, empty, error, offline, and retry state for every selector.
- Never silently coerce an unknown label during payload mapping. Unknown source values block preparation and link back to the owning source record.

Adopt selectors in this order:

1. Business state and MSIC.
2. Buyer and shipping-recipient state/country.
3. Invoice classification, tax type, unit, and payment mode.
4. Currency and remaining document-level code fields.

## Work package 5: Strengthen readiness and contextual policy rules

Membership in a code table is necessary but not always sufficient.

- Validate supplier, buyer, shipping-recipient, document, and every line code against the pinned catalog as of the document issue date.
- Validate both supplier and buyer state codes; the current rules must not check only the buyer.
- Reject state code `17` for a standard Malaysian B2B supplier or buyer. Permit it only in explicitly supported consolidated or non-Malaysian scenarios.
- Require Malaysian address state codes and verify foreign-country handling explicitly.
- Validate that codes applicable only to consolidated or self-billed flows are not used in standard B2B invoices.
- Fail closed before approval, with an actionable field path and link to the reusable business/buyer record.
- Keep MyInvois live TIN search/validation separate. Approval must eventually require a successful, environment-scoped TIN validation record for non-general-public buyers.
- Add fixture coverage for every enabled scenario and for contextually valid-but-disallowed codes.

## Work package 6: Repair legacy source data safely

Create a dry-run migration/report before changing stored business, buyer, shipping, or invoice data.

- Match legacy labels to official descriptions case-insensitively only when the match is unique, for example `Selangor` to `10`.
- Report unknown values, ambiguous matches, and context violations such as Malaysian B2B address code `17`.
- Apply only reviewed, deterministic corrections through tenant-scoped repository operations with audit events.
- Never infer or invent TINs, BRNs, identity numbers, tax types, or business classifications.
- Never mutate approved preparation snapshots, payload bytes, submission history, or official MyInvois UUID records.
- After source correction, require a new preparation revision, approval, payload snapshot, and explicit submission.

## Work package 7: Refresh operations and release policy

- Run a scheduled candidate refresh in CI, initially weekly and on MyInvois release-note changes.
- The scheduled job opens or publishes a diff artifact; it does not automatically promote the catalog.
- Alert when retrieval fails repeatedly, a checksum changes, a table disappears, or the reviewed artifact exceeds the configured freshness threshold.
- Keep the last known good artifact for development and runtime continuity.
- Require full tests, a reviewed diff, golden-payload regeneration, and sandbox validation before promotion.
- Production activation remains blocked when required code sets are missing, expired, or fail integrity checks.
- Document rollback by reverting to the previous reviewed catalog for new preparations only; immutable historical snapshots retain their original version.

## Testing strategy

### Importer and diff tests

- Successful import of all nine representative upstream shapes.
- Timeout, redirect, oversized, non-JSON, empty, malformed, and duplicate responses.
- Deterministic output and checksum stability.
- Added, removed, renamed, and unexpectedly truncated tables.

### Catalog and API tests

- Exact lookup, active-date boundaries, bounded search, pagination, authorization, and cache versioning.
- Missing/expired catalog failure behavior.
- Browser payload excludes the full catalog and server-only implementation.

### UI and accessibility tests

- Code/description rendering, code-only persistence, keyboard selection, mobile layout, 200% zoom, long descriptions, loading, empty, offline, and errors.
- Search behavior for MSIC and unit codes without rendering unbounded lists.

### Readiness and migration tests

- Human state label rejected before approval.
- Standard Malaysian B2B code `17` rejected for supplier and buyer.
- Consolidated/non-Malaysian exceptions only when that scenario is enabled.
- Invalid or stale line codes identify the exact line and source field.
- Dry-run migration is idempotent and never touches frozen snapshots or submission history.

## Delivery sequence

| Session | Scope | Exit outcome |
|---|---|---|
| 1 | Refresh hardening and source schemas | A candidate artifact can be retrieved and verified safely. |
| 2 | Diff, promotion, and catalog health | Reference updates are reviewable and immutable. |
| 3 | Server query service and reference DTOs | Forms can request bounded code options without bundling the catalog. |
| 4 | Business and party selectors plus legacy dry run | State/country/MSIC source records persist official values. |
| 5 | Invoice-line/document selectors | Classification, tax, unit, payment, currency, and type inputs are controlled. |
| 6 | Contextual validation and TIN-validation boundary | Invalid codes and unverified B2B identities block approval. |
| 7 | Scheduled refresh, runbooks, and sandbox proof | A corrected standard B2B invoice reaches `Valid` with version evidence. |

Complete sessions in order. Stop after each session for review; do not combine data migration, UI conversion, and sandbox submission into one change.

## Completion criteria

Stage 7 is complete only when:

- All nine official code tables have validated, checksummed, reviewed, pinned artifacts.
- Every active e-Invoice code input uses catalog-backed selection or an equally strict controlled source.
- Source records persist official codes rather than labels.
- Supplier and buyer state names, invalid state `17` usage, stale codes, and malformed line codes block approval locally.
- TIN search/validation is explicitly separated from static code retrieval and cannot be bypassed for standard B2B approval.
- Approved snapshots preserve their exact catalog version and bytes.
- Legacy cleanup is audited and does not rewrite immutable history.
- Full repository verification passes.
- A new standard Malaysian B2B sandbox document reaches official `Valid` status.

