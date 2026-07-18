# Receivables specialist agent — implementation decision log

## Delivered boundary

The database already represents money owed through the existing `invoices` and
`invoice_payments` lifecycle. This session deliberately does not introduce a
second Supabase receivables table. `record_invoice_payment` already enforces
integer-minor-unit MYR matching, prevents overpayment, and updates invoice
status atomically; invoice status and `due_date` provide the existing paid,
partially-paid, overdue, and void audit model.

For the local Telegram development mode, `receivables.ts` adds a small,
review-ready projection with the same lifecycle rules. It persists owner- and
chat-scoped `receivables.json` and `receivable-payments.json`, validates MYR
amounts and dates, tracks partial/full settlement, prevents overpayment, and
deduplicates payment deliveries with an idempotency key. Overdue is derived in
Malaysia-local date terms rather than persisted. Reminder output is a factual
draft only; it has no transport or send operation.

## Files and tests

- `src/features/transaction-agent/receivables.ts`
- `src/features/transaction-agent/receivables.test.ts`

Focused tests cover creation, partial and full payment, overpayment, duplicate
payment delivery, owner isolation, void exclusion, overdue calculation, and
reminder drafting. The existing invoice migration/RPC remains the authoritative
Supabase implementation.

## Remaining integration

Telegram currently has one persisted `transaction_capture` review workflow.
The next transport slice must persist specialist review cards in that generic
workflow, add explicit customer-choice callbacks for ambiguous matches, and
call the local projection or secured invoice RPC only after owner confirmation.
This prevents the extractor from creating a financial write directly.
