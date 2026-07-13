# Informal Finance Operations

This context describes how owner-operated Malaysian businesses turn informal operational evidence into reviewable financial records, compliance documents, and financing readiness documents.

## Language

**KiraKira**:
A voice-first AI back-office assistant for Malaysian **Launch Businesses** that turns spoken updates and informal operational evidence into reviewable drafts, e-Invoice-ready documents and financing evidence.
_Avoid_: Bookkeeping app, loan app, tax automation bot

**Launch Business**:
An owner-operated Malaysian business earning RM1 million–RM5 million annually and subject to mandatory e-Invoicing.
_Avoid_: SME, target user, merchant

**Expansion Business**:
An owner-operated Malaysian business earning below RM1 million annually that adopts structured record-keeping voluntarily or before becoming obligated.
_Avoid_: exempt user, tiny business

**Business Owner**:
The person who operates a **Launch Business** or **Expansion Business** and supplies its day-to-day financial evidence.
_Avoid_: Customer, end user, merchant

**Evidence Item**:
An original artifact supplied as proof of business activity, such as audio, an image, a message export or a bank row.
_Avoid_: Input, attachment, raw data

**Field Assertion**:
A proposed value for one transaction field linked to an exact location in an **Evidence Item**.
_Avoid_: Extracted truth, AI answer

**Clarification Prompt**:
A focused question asked when a **Field Assertion** is ambiguous or incomplete, such as whether a payment is for an existing invoice, a new sale or a deposit.
_Avoid_: AI guess, assumption, auto-fix

**Candidate Transaction**:
A provisional interpretation of one business event that has not yet been approved by the **Business Owner**.
_Avoid_: Transaction, verified transaction, financial record

**Verified Transaction**:
An immutable version of a **Candidate Transaction** explicitly approved by the **Business Owner**.
_Avoid_: AI transaction, extracted transaction

**E-Invoice Draft**:
A versioned MyInvois document derived from a **Verified Transaction** that has not necessarily been submitted or validated by HASiL.
_Avoid_: Compliant invoice, valid invoice

**Provisional Financial Record**:
A financial summary derived from available **Verified Transactions** whose completeness has not been professionally assured.
_Avoid_: Accounts, audited P&L, complete books

**Financing Evidence Pack**:
An export of source-linked records and completeness indicators that a financing provider may assess independently.
_Avoid_: Loan qualification, credit approval, eligibility score

**Financing Evidence Completeness**:
A measure of how much reviewable evidence exists for revenue, expenses, payments, customers, suppliers and monthly coverage.
_Avoid_: Credit score, loan-readiness score, approval probability

**Financing Readiness**:
A state where a business has organized records and supporting documents that can be reviewed by financing providers.
_Avoid_: Loan qualification, loan approval, guaranteed financing

## Relationships

- **KiraKira** serves a **Business Owner** through a voice-first review flow
- A **Business Owner** operates one **Launch Business** or **Expansion Business** in the initial product scope
- A **Launch Business** is the initial compliance-led market
- An **Expansion Business** is the subsequent financial-inclusion market
- An **Evidence Item** supports one or more **Field Assertions**
- Ambiguous or incomplete **Field Assertions** require a **Clarification Prompt** before owner confirmation
- A **Candidate Transaction** contains one or more **Field Assertions**
- A **Candidate Transaction** becomes a **Verified Transaction** only after explicit owner approval
- A **Verified Transaction** may produce one or more versioned **E-Invoice Drafts**
- **Verified Transactions** contribute to **Provisional Financial Records** and a **Financing Evidence Pack**
- A **Financing Evidence Pack** may include a **Financing Evidence Completeness** measure, but not a financing decision
- **Financing Readiness** depends on reviewable records; it does not imply that a **Launch Business** or **Expansion Business** qualifies for financing

## Product posture

- The first release is compliance-led: e-Invoice-ready records are the wedge, while financing evidence is the compounding value
- The primary interaction is a voice-first assistant cockpit, not a manual-entry bookkeeping dashboard
- Bahasa Malaysia and English code-switching is expected in spoken evidence and assistant responses
- The assistant should use a friendly, local tone while staying careful with tax, financial and financing claims
- The review experience should optimize for trust: show what was heard, what was proposed, what is uncertain, and what the **Business Owner** must confirm
- Business-facing labels may use simple words such as Draft and Confirmed, while the domain model keeps **Candidate Transaction** and **Verified Transaction** precise

## Example dialogue

> **Dev:** "Are we designing the first release for every Malaysian micro-business?"
> **Domain expert:** "No. A **Launch Business** is the first buyer because e-Invoicing creates urgency; an **Expansion Business** receives the same record-building value without relying on mandatory compliance."
>
> **Dev:** "Can the AI submit the extracted sale immediately?"
> **Domain expert:** "No. It produces a **Candidate Transaction** with source-linked **Field Assertions**. Only the owner's approved version becomes a **Verified Transaction** and can produce an **E-Invoice Draft**."
>
> **Dev:** "Should the assistant guess what an unclear DuitNow payment means?"
> **Domain expert:** "No. It should ask a **Clarification Prompt** and keep the affected record in draft until the **Business Owner** confirms it."
>
> **Dev:** "Can the financing report say the business qualifies for funding?"
> **Domain expert:** "No. The **Financing Evidence Pack** can show **Financing Evidence Completeness**, but the financing provider retains the decision."

## Flagged ambiguities

- "Micro-business" previously covered both businesses below RM1 million and businesses up to RM5 million — resolved: use **Launch Business** and **Expansion Business** because their regulatory urgency differs.
- "Verified" previously implied that AI extraction was correct — resolved: verification means explicit owner approval of a source-linked version.
- "Loan readiness" previously implied financing eligibility — resolved: **Financing Evidence Pack** describes document completeness while the provider retains the decision.
- "Voice-first" previously risked implying voice-only — resolved: voice is the primary capture wedge, while images, messages, bank rows and other **Evidence Items** remain valid evidence.
