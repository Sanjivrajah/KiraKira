# Product definition

## Problem

Owner-operated Malaysian businesses in the RM1 million–RM5 million annual-revenue cohort may be obligated to adopt e-Invoicing while still reconstructing transactions from receipts, voice notes, chats, spreadsheets and bank exports. The difficult step is not rendering an invoice: it is resolving fragmented or contradictory evidence into an accurate, auditable transaction before submission.

KiraKira converts that evidence into source-linked candidate transactions, asks the owner only for missing facts, and produces owner-approved records from which MyInvois drafts and provisional financial summaries can be prepared.

## Primary user

The initial persona is an owner-operated wholesaler, distributor or contractor that:

- earns more than RM1 million and up to RM5 million annually;
- records orders through voice, messaging, paper or spreadsheets;
- receives payment through bank transfer or DuitNow;
- lacks dedicated finance operations staff; and
- needs traceability before e-Invoice submission.

Businesses below RM1 million form an expansion segment for voluntary record-building. KiraKira does not base that segment on a blanket mandatory-compliance claim.

## Primary job

Turn fragmented business evidence into an owner-approved, source-linked transaction.

MyInvois preparation is the urgent first output. Provisional reporting is a downstream output. Financing document completeness is a roadmap hypothesis, not a promise of eligibility or approval.

## Jobs to be done

When business activity is scattered across speech, paper and bank records, help me reconstruct what happened without retyping everything, so I can confirm an accurate record and prepare the documents my business needs.

Supporting jobs:

- Show me which proposed values came from which evidence.
- Ask me a small, concrete question instead of guessing when evidence conflicts.
- Tell me what is still missing before an e-Invoice draft can be prepared.
- Preserve a reviewable history that I can export for an accountant or financing provider.

## Product principles

1. **Evidence before automation.** Every critical value must point back to an artifact or an explicit owner answer.
2. **Draft before truth.** AI creates candidates; only owner approval creates a verified record.
3. **Clarify the minimum.** Ask one focused question at a time and reuse previously confirmed business data.
4. **Compliance is a lifecycle.** Distinguish prepared, locally valid, submitted, accepted for processing, validated, rejected and cancelled.
5. **Completeness is not creditworthiness.** Explain missing financing evidence without scoring the business or predicting approval.
6. **Simple outside, precise inside.** The UI may say “Draft” and “Confirmed,” while the domain and audit records remain explicit.

## User-facing states

| Owner-facing label | Domain state | Meaning |
| --- | --- | --- |
| Processing | Evidence received | Extraction or reconciliation is running |
| Draft | Candidate Transaction | Proposed values are ready for review |
| Needs your answer | Clarification required | A blocking ambiguity or missing field exists |
| Ready to confirm | Reviewable candidate | Required assertions pass deterministic checks |
| Confirmed | Verified Transaction | The owner approved this immutable version |
| E-Invoice ready | Locally valid draft | Required local schema and business rules pass |
| Submitted | Submission pending | MyInvois accepted the request for asynchronous processing |
| Validated | MyInvois validated | MyInvois returned a valid document state |
| Needs repair | Rejected or invalid | The failure is explained and a correction can be drafted |

## MVP scenario

A wholesaler records: “Ali took 20 boxes at RM12 and will pay next week.” They attach an order image and later import a matching bank CSV row. KiraKira:

1. transcribes the code-switched voice note;
2. extracts assertions from each evidence item;
3. proposes a credit-sale candidate;
4. flags the missing buyer identifier or a conflicting amount;
5. asks one clarification and shows the relevant source beside the field;
6. requires explicit approval;
7. generates and locally validates a MyInvois draft;
8. submits to the sandbox and polls its asynchronous status when credentials are available;
9. demonstrates one rejection-and-repair path; and
10. reconciles later payment and updates a provisional records-completeness view.

## Success measures

- Median capture-to-approved time compared with manual entry
- Number of manual fields avoided
- Percentage of critical fields backed by visible evidence
- Reconciliation coverage
- MyInvois validation success
- Number of unresolved or contradictory assertions

## MVP acceptance criteria

- A phone user can record audio, photograph one document and upload one supported bank CSV without desktop-only steps.
- The transcript is visible and editable before its assertions are approved.
- Every critical invoice field shows its source artifact and exact location or identifies it as owner-provided.
- Conflicting totals cannot silently resolve; they produce a clarification or explicit owner override.
- Arithmetic, duplicate suspicion and required identity gaps block confirmation.
- Confirmation records the owner, timestamp and exact candidate version.
- A confirmed transaction produces a reproducible MyInvois payload and payload hash.
- The UI never presents an asynchronous submission acknowledgement as validation.
- The financing view reports evidence coverage and missing periods, not eligibility or an approval probability.

## Non-goals for build week

- Autonomous submission or silent ledger changes
- Loan eligibility, credit scoring or lender routing
- Full accounting, tax advice or audited statements
- Inventory management, forecasting, quotations or payment reminders
- Live WhatsApp Business, SMS scraping or bank-login integration
- Native iOS or Android applications
- Universal handwriting and arbitrary-document accuracy
- Every MyInvois document type or tax scenario
- Production MyInvois submission

## Claims we must not use

- That RM150k–RM500k businesses are generally forced into e-Invoicing
- That approximately 156,000 businesses disappeared because they lacked financing documents
- That e-Invoice data is equivalent to complete books or a clean P&L
- That structured records automatically unlock funding or qualify an owner for a loan
- That passing local schema validation alone makes a document HASiL-compliant

## Product risk gates

- If target operators cannot complete the hero transaction with at most one clarification, simplify the evidence set and workflow.
- If reviewed critical-field accuracy is below 95% or correction is not materially faster than manual entry, narrow supported layouts.
- If businesses already solve reconciliation cheaply through existing POS/accounting tools, pivot the primary user to bookkeeping firms or MyInvois rejection repair.
- If financing providers find no value in an evidence pack without audited statements, remove financing from the pitch.
