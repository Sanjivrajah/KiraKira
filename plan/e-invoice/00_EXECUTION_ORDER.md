# E-Invoice and MyInvois Execution Order

## Purpose

This roadmap turns the existing invoice, compliance, and Supabase foundations into a server-authoritative MyInvois workflow. Each numbered plan is intended to be completed in a separate Codex task. Do not begin the next stage early.

## Product outcome

An authorised business user can:

1. Open an e-Invoice workspace.
2. Select eligible saved invoice records.
3. See exactly which required or conditionally required data is missing.
4. Supply document-specific information without re-entering reusable business or customer data.
5. Approve a complete document for submission.
6. Submit signed Invoice v1.1 documents through the MyInvois intermediary flow.
7. Track accepted, rejected, processing, valid, invalid, and cancelled outcomes with an audit trail.

## Current repository reality

- `src/domain/documents/*` already models rich commercial documents.
- `src/compliance/myinvois/*` already contains internal readiness rules, reference-data seams, snapshot types, and hashing helpers.
- `src/components/invoices/invoice-builder.tsx` can construct a rich document in memory.
- The live Supabase invoice write path persists a reduced payment-oriented record, so it cannot reconstruct every MyInvois field reliably after saving.
- The mapper contract exists, but a concrete UBL 2.1 Invoice v1.1 mapper does not.
- MyInvois submission and document-state types exist, but the live repository, authentication, signing, submission, polling, and status-history implementations do not.
- Payment lifecycle state and MyInvois compliance state must remain separate.

## Mandatory field reference

Before any stage changes schemas, readiness rules, forms, or payload mapping, read `REFERENCE_INVOICE_V1_1_FIELD_REQUIREMENTS.md`. It records the verified 55-field guideline checklist, SDK implementation expansions, annexure fields, requirement categories, likely Niaga source, and scenario-overlay rules.

The reference must be reverified against current official guidance before production rules are implemented because MyInvois documentation and code lists can change.

## Stage order

| Stage | Plan | Outcome |
| --- | --- | --- |
| 1 | `01_PERSISTENCE_AND_DOCUMENT_ASSEMBLY.md` | Full supplier, buyer, source, and canonical e-Invoice data survives Supabase persistence. |
| 2 | `02_EINVOICE_PREPARATION_WORKSPACE.md` | Users can select records, complete missing fields, validate, and approve documents without submitting them. |
| 3 | `03_UBL_MAPPING_AND_PAYLOAD_SNAPSHOTS.md` | Approved documents map deterministically to MyInvois Invoice v1.1 payloads and immutable hashes. |
| 4 | `04_INTERMEDIARY_AUTH_AND_DIGITAL_SIGNING.md` | Server-only intermediary authentication and certificate-backed signing are implemented safely. |
| 5 | `05_SANDBOX_SUBMISSION_AND_STATUS_SYNC.md` | Signed batches can be submitted to sandbox and their results reconciled locally. |
| 6 | `06_PRODUCTION_HARDENING_AND_OPERATIONS.md` | The integration is observable, recoverable, permissioned, and ready for a controlled production rollout. |

## Shared implementation rules

- Treat official MyInvois documentation and versioned fixtures as the external contract.
- Keep implementation coverage traceable to `REFERENCE_INVOICE_V1_1_FIELD_REQUIREMENTS.md` and its verified official sources.
- Do not create a flat form that makes every user fill all 55 fields. Model applicability, cardinality, derivation, and scope.
- Keep reusable supplier data in business settings, reusable buyer data in party/customer records, and one-off values on the e-Invoice document.
- Never reconstruct submitted documents from mutable source records. Freeze the exact approved document and payload.
- Never expose client secrets, access tokens, certificates, private keys, or service-role credentials to browser code.
- Do not overload `invoices.status` with MyInvois states.
- Every query and mutation must be scoped by `business_id` and protected by RLS plus server-side authorisation.
- Preserve the explicit demo adapter. Supabase failures must not fall back to browser storage.
- Keep UI handlers thin; assembly, validation, mapping, signing, submission, and reconciliation belong in testable services.
- Use append-only status history for external submission events.
- Do not claim official validity until MyInvois returns `Valid`.

## Standard verification gate

Run the repository's focused tests for the changed slice, followed when feasible by:

```bash
npm run typecheck
npm run lint
npm test
npm run build
git diff --check
```

If a repo-wide command fails for an unrelated baseline or restricted-network reason, record the exact failure and still run focused tests and `git diff --check`.

## Completion rule

The roadmap is complete only when a sandbox invoice can travel from a persisted source invoice through preparation, approval, deterministic mapping, signing, submission, and final status reconciliation without browser-held secrets or manual database editing.
