# MyInvois unsigned Invoice v1.0 execution order

## Product boundary

NiagaAI has one active MyInvois document path: unsigned UBL JSON Invoice v1.0. Callers cannot choose another document version. Invoice v1.1, embedded digital signatures, certificates, and private keys are outside the active application. Historical signing tables remain only as deprecated migration artifacts and are inaccessible to normal application roles.

The initial production scenario is a standard Malaysian B2B invoice. Consolidated, self-billed, foreign-buyer, adjustment, import/export, and any other scenario stay disabled until each has reviewed golden fixtures, a successful sandbox lifecycle, and explicit product approval.

Before changing fields, readiness, or payload mapping, read `REFERENCE_INVOICE_V1_0_FIELD_REQUIREMENTS.md`. The official Invoice v1.0 SDK page is the payload contract; the guideline appendix remains a capture and policy checklist.

## Six-stage roadmap

| Stage | Plan | Exit outcome |
|---|---|---|
| 1 | `01_PERSISTENCE_AND_DOCUMENT_ASSEMBLY.md` | Tenant-scoped source records assemble into a canonical preparation record with explicit provenance and missing-field diagnostics. |
| 2 | `02_EINVOICE_PREPARATION_WORKSPACE.md` | Users can complete, validate, approve, freeze, and revise preparation records without silently omitting applicable data. |
| 3 | `03_UBL_MAPPING_AND_PAYLOAD_SNAPSHOTS.md` | Approved records map deterministically to unsigned Invoice v1.0 JSON and immutable exact-byte snapshots with pinned hashes and reference versions. |
| 4 | `04_TAXPAYER_AND_INTERMEDIARY_AUTHENTICATION.md` | Server-only taxpayer or intermediary OAuth is verified per environment, without certificate or signing operations. |
| 5 | `05_SANDBOX_SUBMISSION_AND_STATUS_RECONCILIATION.md` | Persisted v1.0 snapshots submit idempotently and reconcile to official terminal status, including partial acceptance and cancellation. |
| 6 | `06_PRODUCTION_HARDENING_AND_OPERATIONS.md` | Production is observable, recoverable, auditable, redacted, explicitly activated, and protected by emergency disable. |

Complete stages in order. A later stage may depend on a stable earlier contract but must not weaken its tenant isolation, immutable-history, or fail-closed rules.

## Cross-stage rules

- Persist only `documentVersion: "1.0"` in active records. Existing v1.1 or signed records are historical and return a safe `unsupported historical version` diagnostic.
- Generate and submit the exact stored unsigned bytes. Hash and base64 those bytes; never reconstruct a payload from JSONB.
- Map every applicable field accepted by the preparation UI. A field that cannot be mapped must block approval instead of disappearing from the payload.
- Keep browser code free of OAuth client secrets, certificates, signing keys, raw provider errors, and sensitive payload logs.
- Keep transport handlers thin; assembly, readiness, mapping, authentication, submission, reconciliation, and operations belong in testable services.
- Keep sandbox and production credentials, verification, activation, throttles, and audit histories separate.
- Preserve durable polling, bounded retries, dead-letter handling, production disable, cancellation history, tenant isolation, and secret redaction.

## Verification and evidence

Each stage runs focused tests while iterating and the repository gate before handoff: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `git diff --check`. With Docker available, apply migrations to both a clean database and a representative upgraded database and run pgTAP/RLS tests.

The integration is technically complete only after a real sandbox standard Malaysian B2B invoice travels from persisted source through preparation, approval, v1.0 mapping, submission, and reconciliation to `Valid` or an actionable `Invalid`, with evidence recorded. Stage 6 remains incomplete until load/recovery checks, alerts, runbooks, backup/restore validation, and a controlled production pilot with emergency-disable evidence are documented.

## Future Invoice v1.1 decision

Adopting Invoice v1.1 requires a new roadmap, an organisation certificate, refreshed official references, reviewed golden fixtures, sandbox validation, and explicit product approval. Do not reactivate historical signing application code.
