# Loan readiness implementation

This document describes the current implementation of `/loan-readiness`.
It is an indicative cash-flow simulation, not a lender decision, financing
offer, credit score, or financial advice.

## What the feature does

The workspace helps a business owner explore whether confirmed cash-flow
records could support a proposed monthly repayment. It shows:

- a proposed-loan instalment for the amount, rate, and tenure entered;
- indicative maximum monthly repayment and potential principal;
- debt-service coverage ratio (DSCR) for base, cautious, and stressed cases;
- data-history and confirmation-coverage checks; and
- recurring obligations inferred from confirmed ledger records.

The result is calculated on demand. The GET assessment and POST simulation do
not save or alter transactions, invoices, or any other accounting records.
The browser refreshes its readiness query after relevant transaction changes.

## Data used

The server reads only the active business's `transactions` rows that are:

- in MYR;
- not voided; and
- visible to the signed-in user through an active `business_members` record.

Only `confirmed` transactions contribute to cash flow and the assessment's
month history. The confirmation-coverage check uses confirmed transactions as
a share of all selected non-voided MYR transactions.

The implementation excludes transactions whose `category_code` contains
`transfer`, `loan`, `financing`, `owner`, `capital`, `refund`, or `draw` from
operating cash flow. This avoids treating owner movements, financing proceeds,
and transfers as normal operating income or expenses.

## Calculation method

All calculations use the selected confirmed transaction history, up to the
latest twelve transaction months.

### Monthly operating cash flow

For each reviewed month, the implementation calculates:

```text
monthly CFADS = operating income − operating expenses
```

Here, CFADS is a conservative cash-flow proxy available for debt service. It
is not a bank-statement reconciliation or a formal accounting measure.

The assessment uses the lowest of several cash-flow views as its conservative
CFADS value: the overall monthly average, the latest six-month average, and
recent short rolling averages. This limits the result when recent or shorter
periods are weaker than the full-history average.

### Proposed instalment

For a principal `P`, annual rate `r` percent, and tenure `n` months:

```text
i = r / 100 / 12
instalment = P × i × (1 + i)^n / ((1 + i)^n − 1)
```

When the annual rate is zero, the instalment is simply `P / n`. Monetary
results are rounded to two decimal places.

### Debt service, DSCR, and capacity

```text
existing debt service = sum(inferred monthly repayments)
total debt service = existing debt service + proposed instalment
DSCR = conservative CFADS / total debt service
maximum monthly repayment = max(0, conservative CFADS / 1.25 − existing debt service)
```

DSCR is unavailable when there is no debt service to divide by. The illustrative
potential loan amount is the principal that would produce the maximum monthly
repayment using a fixed 8% annual rate over 36 months. Those assumptions are
shown in the UI and are not lender-specific terms.

The cautious scenario reduces monthly inflows by 10% and raises outflows by
5%. The stressed scenario reduces inflows by 25% and raises outflows by 10%.
Each scenario recalculates conservative CFADS and DSCR using the same debt
service.

### Readiness status

Before a positive readiness status is possible, the data must contain at least
six consecutive completed confirmed months and at least 80% confirmed coverage.
Otherwise the status is `insufficient_data`. With sufficient data, the current
DSCR bands are:

| DSCR | Status |
| --- | --- |
| unavailable | needs review |
| below 1.00x | not ready |
| 1.00x–below 1.25x | borderline |
| 1.25x–below 1.50x | ready |
| 1.50x or higher | strong |

These bands are product rules for an indicative workspace, not approval rules
or a universal lending standard.

## Inferred debt records: no LLM is involved

The current inferred-debt detection is deterministic code. It does not call an
LLM, inspect transaction descriptions, or make a model-based judgement.

For each transaction category, the implementation considers a debt candidate
only when it is a confirmed expense and its `category_code` contains `loan`,
`repay`, or `finance`. It then:

1. looks at the most recent six matching records in that category;
2. requires at least three records;
3. calculates their median amount; and
4. keeps records within 10% of that median, requiring at least three consistent
   records.

If the rule passes, the median becomes an inferred monthly repayment with a
fixed confidence of 0.9. The matching transaction IDs are returned with the
assessment so the UI can disclose that this is an inference.

The current UI does not save inferred debts. It recalculates them from the
ledger every time. A future reviewed-debt feature should store an explicit
owner decision separately from the transaction ledger.

## Why invoices are not included

Invoices are not cash receipts. A draft or issued invoice is a request for
payment and may be edited, cancelled, disputed, overdue, partially paid, or
never paid. Counting it as income would overstate repayment capacity.

For that reason, the current readiness endpoint reads the confirmed
`transactions` ledger only. Invoice edits currently invalidate the browser's
readiness query, but they do not change the assessment unless they also cause a
confirmed MYR transaction to change. Invoice payments are likewise not read
directly by the readiness calculation today.

To make an invoice payment affect readiness in the future, it should create or
link to one deduplicated confirmed income transaction in the ledger. The
assessment can then refresh from that authoritative cash record without
double-counting the invoice and its payment.

## How this helps users

The feature gives owners a conservative, explainable way to prepare before a
lender conversation. It can help them:

- test the monthly impact of different financing amounts, rates, and tenures;
- identify whether a recent weak period reduces indicative capacity;
- see whether confirmed-record history is sufficient for a meaningful view;
- identify recurring repayments that may need review; and
- focus on confirming and categorising actual cash records rather than relying
  on unpaid sales expectations.

## Limitations and future persistence

The feature does not connect to banks, reconcile balances, verify liabilities,
use credit-bureau data, account for all fees, or submit an application to any
lender. It does not use an LLM for the calculation or debt inference, and it
does not make a prediction of approval or default.

The current POC has no readiness-specific persistence tables. A result should
be saved only in a future feature where a user explicitly chooses to save a
scenario, compare it later, or create an export. That future saved record must
pin its rule version and source-data snapshot.
