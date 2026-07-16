# Invoice readiness specialist agent — implementation decision log

## Delivered boundary

`src/features/transaction-agent/invoice-readiness.ts` adds a typed, deterministic
readiness service over the canonical `CommercialDocument`, `Party`, `Business`,
and MyInvois validation contracts. It groups existing rule failures into buyer,
seller, invoice, line-item, and tax-classification questions; retains source
transaction/document/party references; and selects the next concise
clarification. The service persists only a reviewable draft through an injected
repository. It has no provider client, mapper invocation, or MyInvois submission
operation.

The canonical document status remains authoritative. The Telegram-facing draft
lifecycle (`draft`, `needs_information`, `ready_for_review`, `approved`,
`cancelled`) is deliberately separate from `submitted`: approval records owner
review only and is not an LHDN submission.

## Actual schemas and assumptions

- Canonical `commercialDocumentSchema`, `partySchema`, and `businessDomainSchema`
  provide the invoice data contract.
- `validateMyInvoisReadiness` and the checked-in development reference-code
  snapshot provide the required-field, conditional-field, and code checks.
- The existing local Telegram store has confirmed transactions but no canonical
  customer/business profile repository. Therefore this slice exposes a typed
  repository boundary and deterministic intent matching, rather than inventing
  profile data or silently making a financial record from model output.

## Tests

`invoice-readiness.test.ts` covers a ready draft, missing buyer TIN, conditional
foreign-currency field, invalid date, canonical total mismatch, ambiguous
matching, source-attachment protection, owner isolation, draft correction,
repeated approval, unsupported document type, and the absence of a submission
path. Focused tests, typecheck, lint, and the whitespace diff check pass.

## Follow-up

The next Telegram transport slice should resolve owner-scoped canonical business,
customer, and confirmed transaction records, persist this repository in local
and Supabase modes, then present the one-at-a-time clarification/review callbacks.
