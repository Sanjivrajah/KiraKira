# KiraKira

KiraKira is a voice-first evidence reconciliation assistant for owner-operated Malaysian businesses.

It turns receipts, voice orders and bank exports into owner-approved, source-linked transactions, then prepares MyInvois documents and provisional financial records from the same evidence.

## Product thesis

Businesses do not primarily struggle to type an invoice. They struggle to resolve incomplete and contradictory evidence into a trustworthy transaction before invoicing. KiraKira preserves the evidence, proposes the transaction, asks only for missing facts, and requires approval before creating a financial record or submission.

The launch segment is owner-operated Malaysian businesses earning more than RM1 million and up to RM5 million annually that are subject to e-Invoicing and still rely on mixed manual records. Businesses below RM1 million are a later financial-inclusion segment; the product does not claim they are generally required to adopt e-Invoicing.

## Golden path

1. Capture a code-switched voice order, receipt image and bank CSV row.
2. Extract field-level assertions linked to their exact evidence.
3. Create a candidate transaction and highlight conflicts or missing facts.
4. Ask one plain-language clarification.
5. Let the owner review and approve an immutable transaction version.
6. Generate and validate a MyInvois-ready draft.
7. Show provisional reporting and document completeness from approved records.

## Documentation

- [Product definition](docs/PRODUCT.md)
- [Technical direction](docs/TECHNICAL.md)
- [Build-week demo](docs/DEMO.md)
- [Domain language](CONTEXT.md)
- [Architecture decision](docs/adr/0001-build-an-evidence-first-pwa.md)

## Status

Product definition and architecture are settled. Implementation has not started.
