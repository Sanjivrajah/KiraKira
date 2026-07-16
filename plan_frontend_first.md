# NiagaAI Frontend-First Build Plan

## 1. Purpose

This plan focuses on building the NiagaAI user interface and frontend product experience before adding AI, e-invoicing, voice, forecasting, or other backend-heavy integrations.

The immediate goal is to create a polished, clickable, mobile-first application that demonstrates the complete NiagaAI experience using mock data and local state.

The frontend should communicate the product vision clearly enough for a hackathon demo even before real integrations are connected.

---

## 2. Frontend Goal

Build a responsive NiagaAI web application optimized for desktop, tablet,
and mobile.

The application should use a mobile-first implementation approach because
many micro-business owners will access NiagaAI from their phones. However,
desktop users should receive a complete dashboard experience with side
navigation, wider tables, multi-column forms, charts, reports, and financial
management workflows.

Build a responsive NiagaAI application that allows a user to:

1. Sign in through a mock authentication flow.
2. View a business dashboard.
3. Add a transaction manually.
4. Upload a receipt through a simulated flow.
5. Review extracted transaction fields using mock data.
6. Save transactions locally or through a simple mock API.
7. View income, expenses, and recent activity.
8. Create simple invoices and quotations.
9. View outstanding payments.
10. View inventory movements.
11. View a loan-readiness summary.
12. Preview an e-invoice-ready record.

No real AI or external API implementation is required in this phase.

---

## 3. Technology Stack

### Core

- Next.js
- TypeScript
- App Router
- Tailwind CSS
- shadcn/ui

### Forms and Validation

- React Hook Form
- Zod

### Data and State

Choose one simple option:

- React state and context for very small scope
- Zustand for shared client state
- TanStack Query if using a mock or real backend API

Recommended:

- Zustand for local application state
- TanStack Query only when backend integration begins

### Charts

- Recharts

### Icons

- Lucide React

### Testing

- Vitest
- React Testing Library
- Playwright for one end-to-end demo flow

### Code Quality

- ESLint
- Prettier
- TypeScript strict mode

---

## 4. Product Principles

1. Build mobile-first.
2. Keep the interface simple for non-technical micro-business owners.
3. Use plain language.
4. Support English and Bahasa Malaysia labels later.
5. Make financial information easy to understand.
6. Use clear confirmation states.
7. Avoid exposing technical accounting terms unnecessarily.
8. Make every important action visible within one or two taps.
9. Use mock data that looks realistic for Malaysian MSMEs.
10. Keep frontend contracts stable so real APIs can replace mocks later.

---

## 5. Full Frontend Feature Map

### A. Authentication and Onboarding

- Welcome screen
- Sign-in screen
- Sign-up screen
- Business setup form
- Business name
- Business type
- Registration number
- TIN
- Preferred currency
- Preferred language
- Mock completion state

### B. Dashboard

- Total income
- Total expenses
- Net cash flow
- Outstanding payments
- Inventory alerts
- Draft transactions
- Recent transactions
- Quick actions
- Financial health summary
- Loan-readiness card
- E-invoice readiness card

### C. Transactions

- Transaction list
- Search
- Filters
- Date filters
- Income and expense tabs
- Transaction details
- Add transaction
- Edit transaction
- Delete draft transaction
- Confirm transaction
- Draft status
- Confirmed status

### D. Receipt Upload Flow

- Upload screen
- Drag-and-drop area
- Camera capture button
- File selection
- Supported file types
- File preview
- Mock processing state
- Mock extracted data
- Editable review form
- Confirm and save
- Error state
- Unsupported file state

### E. Manual Transaction Entry

- Income or expense selection
- Date
- Customer or supplier
- Description
- Category
- Amount
- Tax
- Payment method
- Line items
- Notes
- Save as draft
- Confirm

### F. Invoices and Quotations

- Invoice list
- Quotation list
- Create invoice
- Create quotation
- Customer selection
- Line items
- Subtotal
- Tax
- Total
- Payment status
- Draft status
- Preview
- Download button placeholder
- Send button placeholder

### G. Outstanding Payments

- Outstanding invoice list
- Customer name
- Amount due
- Due date
- Days overdue
- Status
- Reminder action
- Mock reminder preview
- Mark as paid

### H. Inventory

- Inventory list
- Product name
- SKU
- Current quantity
- Low-stock status
- Stock-in action
- Stock-out action
- Inventory movement history
- Add inventory item
- Edit inventory item

### I. Cash Flow and Reports

- Income summary
- Expense summary
- Net cash flow
- Monthly trend chart
- Category breakdown
- Profit estimate
- Download report placeholder
- Date-range filters

### J. Loan Readiness

- Overall readiness score
- Revenue consistency
- Record completeness
- Cash-flow stability
- Outstanding-payment ratio
- Compliance readiness
- Improvement recommendations
- Download report placeholder

### K. E-Invoice Readiness

- E-invoice-ready transaction list
- Missing fields indicator
- Business details completion status
- Customer details completion status
- Tax information status
- Invoice preview
- Submission button placeholder
- Sandbox status placeholder

### L. Settings

- Business profile
- User profile
- Preferred language
- Notification settings
- Data export placeholder
- Security settings placeholder
- Logout

---

## 6. Frontend Navigation

Recommended primary navigation:

```text
Dashboard
Transactions
Invoices
Payments
Inventory
Reports
Loan Readiness
Settings
```

Recommended mobile bottom navigation:

```text
Home
Transactions
Add
Invoices
More
```

The central Add button should open:

- Upload receipt
- Add income
- Add expense
- Create invoice
- Create quotation

---

## 7. Suggested Route Structure

```text
app/
├── page.tsx
├── login/
│   └── page.tsx
├── onboarding/
│   └── page.tsx
├── dashboard/
│   └── page.tsx
├── transactions/
│   ├── page.tsx
│   ├── new/
│   │   └── page.tsx
│   ├── upload/
│   │   └── page.tsx
│   └── [id]/
│       └── page.tsx
├── invoices/
│   ├── page.tsx
│   ├── new/
│   │   └── page.tsx
│   └── [id]/
│       └── page.tsx
├── quotations/
│   ├── page.tsx
│   └── new/
│       └── page.tsx
├── payments/
│   └── page.tsx
├── inventory/
│   ├── page.tsx
│   └── [id]/
│       └── page.tsx
├── reports/
│   └── page.tsx
├── loan-readiness/
│   └── page.tsx
├── e-invoice/
│   └── page.tsx
└── settings/
    └── page.tsx
```

Adapt this to the repository's existing structure instead of forcing a rewrite.

---

## 8. Component Structure

Recommended reusable components:

```text
components/
├── layout/
│   ├── app-shell.tsx
│   ├── sidebar.tsx
│   ├── mobile-nav.tsx
│   └── topbar.tsx
├── dashboard/
│   ├── metric-card.tsx
│   ├── recent-transactions.tsx
│   ├── quick-actions.tsx
│   └── financial-health-card.tsx
├── transactions/
│   ├── transaction-card.tsx
│   ├── transaction-table.tsx
│   ├── transaction-form.tsx
│   ├── transaction-status-badge.tsx
│   └── receipt-upload.tsx
├── invoices/
│   ├── invoice-form.tsx
│   ├── invoice-preview.tsx
│   └── invoice-status-badge.tsx
├── inventory/
│   ├── inventory-card.tsx
│   ├── stock-movement-form.tsx
│   └── low-stock-badge.tsx
├── reports/
│   ├── cash-flow-chart.tsx
│   ├── category-chart.tsx
│   └── report-filter.tsx
├── shared/
│   ├── empty-state.tsx
│   ├── loading-state.tsx
│   ├── error-state.tsx
│   ├── confirmation-dialog.tsx
│   ├── page-header.tsx
│   └── money-display.tsx
└── forms/
    ├── currency-input.tsx
    ├── date-field.tsx
    ├── line-items-editor.tsx
    └── category-select.tsx
```

---

## 9. Mock Data Strategy

Create realistic mock data rather than hardcoding values inside pages.

Recommended structure:

```text
src/
├── mocks/
│   ├── businesses.ts
│   ├── transactions.ts
│   ├── invoices.ts
│   ├── customers.ts
│   ├── inventory.ts
│   ├── reports.ts
│   └── loan-readiness.ts
├── types/
│   ├── business.ts
│   ├── transaction.ts
│   ├── invoice.ts
│   ├── customer.ts
│   ├── inventory.ts
│   └── report.ts
└── store/
    └── use-niaga-store.ts
```

Use Malaysian-style demo data, for example:

- Kedai Maju Jaya
- Warung Kak Lina
- Ali Trading
- Nasi Lemak Sale
- Grocery Purchase
- DuitNow
- Cash
- Bank Transfer
- MYR

Do not use random values that change on every render.

---

## 10. Core Frontend Data Types

### Transaction

```ts
export type TransactionStatus = "draft" | "confirmed";
export type TransactionType = "income" | "expense";

export interface TransactionItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Transaction {
  id: string;
  status: TransactionStatus;
  type: TransactionType;
  date: string;
  counterpartyName: string;
  description: string;
  category: string;
  currency: "MYR";
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string;
  sourceType: "manual" | "receipt" | "voice" | "csv";
  items: TransactionItem[];
  createdAt: string;
}
```

### Invoice

```ts
export type InvoiceStatus =
  | "draft"
  | "sent"
  | "partially_paid"
  | "paid"
  | "overdue";

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  subtotal: number;
  tax: number;
  total: number;
  amountPaid: number;
  currency: "MYR";
  items: TransactionItem[];
}
```

### Inventory Item

```ts
export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  reorderLevel: number;
  unitCost: number;
  sellingPrice: number;
  updatedAt: string;
}
```

---

## 11. Phase 0 — Inspect the Existing Repository

### Objective

Understand the existing project before changing it.

### Tasks

- Inspect repository structure.
- Identify current Next.js setup.
- Identify package manager.
- Check Tailwind and component library setup.
- Check existing routes and components.
- Check linting and testing.
- Check whether an `AGENTS.md` file exists.
- Document gaps.
- Do not install dependencies yet.

### Acceptance Criteria

- Existing structure is documented.
- No unnecessary refactor is made.
- Existing working code is preserved.
- Missing frontend setup is listed.

### Codex Prompt

```text
Inspect the entire repository.

Read AGENTS.md if present, plan.md, README files, package manifests,
TypeScript configuration, Tailwind configuration, and all existing routes
and components.

Create docs/frontend-repository-status.md containing:

- current frontend structure
- current framework and versions
- package manager
- available scripts
- current styling setup
- current component library
- current state-management approach
- current testing setup
- missing frontend foundations
- recommended next task

Do not install dependencies.
Do not restructure the repository.
Do not implement product features.

At the end, report:
- files inspected
- files created or changed
- unresolved issues
```

---

## 12. Phase 1 — Design System and App Shell

### Objective

Create the shared visual foundation.

### Tasks

- Create app shell.
- Add desktop sidebar.
- Add mobile bottom navigation.
- Add top bar.
- Add page container.
- Add typography scale.
- Add spacing rules.
- Add shared buttons.
- Add cards.
- Add badges.
- Add form controls.
- Add loading state.
- Add empty state.
- Add error state.
- Add confirmation dialog.
- Add responsive behavior.

### Acceptance Criteria

- App shell works on mobile and desktop.
- Navigation is consistent.
- All pages use the same layout.
- Shared UI components are reusable.
- No page-specific duplicated navigation code exists.
- Basic accessibility is present.

### Codex Prompt

```text
Read AGENTS.md, plan.md, and docs/frontend-repository-status.md.

Build the NiagaAI frontend foundation.

Implement:

- responsive app shell
- desktop sidebar
- mobile bottom navigation
- top bar
- reusable page header
- reusable metric card
- loading state
- empty state
- error state
- confirmation dialog
- money display component

Use the existing styling system where possible.

Constraints:

- Do not implement backend calls.
- Do not implement authentication.
- Do not implement AI.
- Do not build feature pages yet.
- Do not add unnecessary dependencies.

Run linting and type checks.

At the end, report:
- files changed
- components added
- commands run
- unresolved issues
```

---

## 13. Phase 2 — Mock Authentication and Onboarding

### Objective

Create a complete first-time user experience.

### Tasks

- Welcome page.
- Sign-in form.
- Sign-up form.
- Mock authentication state.
- Business onboarding form.
- Business details preview.
- Completion state.
- Redirect to dashboard.

### Acceptance Criteria

- User can enter the app through a mock sign-in.
- User can complete business onboarding.
- Form validation works.
- Data is stored locally.
- Refresh behavior is documented.
- No real auth provider is connected.

### Codex Prompt

```text
Implement mock authentication and onboarding.

Requirements:

- welcome screen
- sign-in screen
- sign-up screen
- business onboarding form
- client-side validation using Zod
- mock authenticated state
- local persistence
- redirect to dashboard after onboarding
- clear error and success states

Do not connect Supabase Auth.
Do not add backend APIs.
Do not implement AI.

Run linting and type checks.
```

---

## 14. Phase 3 — Dashboard

### Objective

Build the main NiagaAI overview.

### Dashboard Content

- Greeting
- Business name
- Income card
- Expense card
- Net cash flow card
- Outstanding payments card
- Quick actions
- Recent transactions
- Inventory alert
- Loan-readiness card
- E-invoice readiness card

### Acceptance Criteria

- Dashboard is responsive.
- Data comes from mock files or store.
- Empty state works.
- Cards link to relevant pages.
- Quick actions are usable.
- Financial values use a shared money formatter.

### Codex Prompt

```text
Build the NiagaAI dashboard using mock data.

Include:

- business greeting
- total income
- total expenses
- net cash flow
- outstanding payments
- quick actions
- recent transactions
- low-stock alert
- loan-readiness summary
- e-invoice readiness summary

Requirements:

- mobile-first layout
- reusable components
- mock data from dedicated files
- loading and empty states
- consistent MYR formatting
- links to relevant pages

Do not call any APIs.
Do not implement AI.
Do not add real charts yet unless already available.

Run linting and type checks.
```

---

## 15. Phase 4 — Transactions

### Objective

Create the main transaction management experience.

### Tasks

- Transaction list.
- Income and expense filters.
- Search.
- Status filter.
- Date filter.
- Transaction detail page.
- Manual transaction form.
- Save as draft.
- Confirm transaction.
- Edit draft.
- Delete draft.
- Local state updates.

### Acceptance Criteria

- User can create a manual transaction.
- User can save a draft.
- User can confirm it.
- Dashboard totals update.
- Transaction list updates.
- Form validation works.
- Confirmed transactions are visually distinct.

### Codex Prompt

```text
Implement the frontend transaction experience using mock/local data.

Build:

- transaction list
- search
- income and expense filters
- status filter
- transaction detail page
- manual transaction form
- line-item editor
- save as draft
- confirm transaction
- edit draft
- delete draft
- confirmation dialog

Use Zustand or the existing state approach.

Requirements:

- TypeScript types
- Zod validation
- responsive layout
- loading, empty, and error states
- dashboard totals update from the same local store

Do not add backend APIs.
Do not implement receipt AI extraction.
Do not implement authentication providers.

Run linting, type checks, and relevant tests.
```

---

## 16. Phase 5 — Receipt Upload Simulation

### Objective

Demonstrate the receipt workflow without AI.

### Tasks

- Upload page.
- File selector.
- Camera button placeholder.
- JPG, PNG, PDF validation.
- File preview.
- Simulated processing animation.
- Fixed mock extraction response.
- Editable review form.
- Save draft.
- Confirm transaction.

### Mock Flow

```text
Select receipt
    ↓
Show preview
    ↓
Simulate processing
    ↓
Load mock extracted values
    ↓
Review and edit
    ↓
Save or confirm
```

### Acceptance Criteria

- Supported files can be selected.
- Unsupported files show an error.
- Processing state is visible.
- Mock data populates the review form.
- User can edit all values.
- Confirmed record appears in transactions and dashboard.
- No AI call exists.

### Codex Prompt

```text
Implement a simulated receipt upload flow.

Requirements:

- accept JPG, PNG, and PDF
- validate file type and size
- show filename
- show image preview where supported
- show simulated processing state
- populate the review form using fixed mock extraction data
- allow editing
- allow save as draft
- allow confirm
- update the shared transaction store

Create the mock extraction data in a dedicated file.

Do not call OpenAI.
Do not call any backend.
Do not add OCR.
Do not add upload storage.

Run linting, type checks, and relevant tests.
```

---

## 17. Phase 6 — Invoices and Quotations

### Objective

Build simple invoice and quotation creation interfaces.

### Tasks

- Invoice list.
- Quotation list.
- Create invoice.
- Create quotation.
- Customer fields.
- Line items.
- Automatic totals.
- Status badges.
- Preview page.
- Mock download action.
- Mock send action.

### Acceptance Criteria

- User can create an invoice.
- User can create a quotation.
- Totals calculate correctly.
- Draft state is supported.
- Invoice preview looks professional.
- Mock actions are clearly labelled.

### Codex Prompt

```text
Implement frontend-only invoices and quotations.

Build:

- invoice list
- quotation list
- invoice form
- quotation form
- customer details
- line-item editor
- automatic subtotal, tax, and total
- status badges
- preview screen
- mock download action
- mock send action

Use local state and mock data.

Do not generate real PDFs.
Do not send emails.
Do not call backend services.
Do not implement MyInvois submission.

Run linting and type checks.
```

---

## 18. Phase 7 — Outstanding Payments

### Objective

Show unpaid and overdue customer payments.

### Tasks

- Outstanding list.
- Customer name.
- Amount due.
- Due date.
- Days overdue.
- Status.
- Mark as paid.
- Reminder preview.
- Mock reminder action.

### Acceptance Criteria

- Paid and unpaid states are clear.
- Overdue items are highlighted.
- Mark-as-paid updates dashboard.
- Reminder preview is understandable.
- No SMS, email, or WhatsApp is sent.

### Codex Prompt

```text
Implement the outstanding payments frontend.

Include:

- outstanding payment list
- customer name
- amount due
- due date
- overdue duration
- status badges
- mark as paid
- reminder preview
- mock send reminder action

Use local state.

Do not send real messages.
Do not connect email, SMS, or WhatsApp.
Run linting and type checks.
```

---

## 19. Phase 8 — Inventory

### Objective

Build lightweight stock management screens.

### Tasks

- Inventory list.
- Search.
- Low-stock filter.
- Add item.
- Edit item.
- Stock in.
- Stock out.
- Movement history.
- Low-stock badge.
- Dashboard alert integration.

### Acceptance Criteria

- Inventory items can be added.
- Stock quantities can change.
- Invalid negative quantities are blocked.
- Low-stock status updates.
- Dashboard inventory alert updates.

### Codex Prompt

```text
Implement the frontend-only inventory module.

Build:

- inventory list
- search
- low-stock filter
- add item form
- edit item form
- stock-in action
- stock-out action
- movement history
- low-stock badges
- dashboard alert integration

Use local state.
Prevent invalid negative quantities.

Do not add backend APIs.
Do not add barcode scanning.
Run linting and type checks.
```

---

## 20. Phase 9 — Reports

### Objective

Show financial trends using local data.

### Tasks

- Income summary.
- Expense summary.
- Net cash flow.
- Monthly trend chart.
- Category chart.
- Date-range filter.
- Profit estimate.
- Download placeholder.

### Acceptance Criteria

- Charts use existing mock transactions.
- Filters update the results.
- Empty state works.
- Calculations are deterministic.
- No AI forecast is included.

### Codex Prompt

```text
Implement frontend financial reports using existing local transaction data.

Include:

- total income
- total expenses
- net cash flow
- monthly trend chart
- category breakdown chart
- date-range filter
- simple deterministic profit estimate
- mock download report action

Do not implement forecasting.
Do not add AI-generated explanations.
Do not call backend APIs.

Run linting and type checks.
```

---

## 21. Phase 10 — Loan Readiness UI

### Objective

Demonstrate the financing-readiness concept without real scoring or lender integration.

### Tasks

- Overall readiness score.
- Readiness progress indicator.
- Revenue consistency card.
- Record completeness card.
- Cash-flow stability card.
- Outstanding-payment ratio.
- Compliance readiness.
- Improvement recommendations.
- Download placeholder.

### Important Rule

Use fixed mock values or simple deterministic values from the local data.

Do not claim that the score represents actual bank approval.

### Acceptance Criteria

- Score is clearly labelled as indicative.
- Improvement actions are visible.
- No lender eligibility claim is made.
- No real credit decision occurs.

### Codex Prompt

```text
Implement the loan-readiness frontend using mock or deterministic local data.

Include:

- overall readiness score
- indicative-only disclaimer
- revenue consistency
- record completeness
- cash-flow stability
- outstanding-payment ratio
- compliance readiness
- improvement recommendations
- mock download report action

Do not implement AI scoring.
Do not claim loan approval.
Do not connect banks or government agencies.

Run linting and type checks.
```

---

## 22. Phase 11 — E-Invoice Readiness UI

### Objective

Demonstrate e-invoice readiness without calling LHDN.

### Tasks

- Readiness list.
- Missing-field indicators.
- Business details completion.
- Customer details completion.
- Tax information completion.
- Invoice preview.
- Submission button placeholder.
- Sandbox label.
- Clear unavailable state.

### Acceptance Criteria

- User can see what data is missing.
- Preview is realistic.
- Submit action is clearly mocked or disabled.
- No claim of successful LHDN submission is made.

### Codex Prompt

```text
Implement the e-invoice readiness frontend only.

Include:

- e-invoice-ready transaction list
- missing-field indicators
- business information completeness
- customer information completeness
- tax information completeness
- invoice preview
- disabled or mock submission button
- clear sandbox/demo label

Do not call MyInvois.
Do not implement LHDN authentication.
Do not claim successful submission.

Run linting and type checks.
```

---

## 23. Phase 12 — Polish and Demo Preparation

### Objective

Make the frontend hackathon-ready.

### Tasks

- Improve responsive layouts.
- Add skeleton loaders.
- Add consistent empty states.
- Add consistent error messages.
- Add toast notifications.
- Add transitions.
- Add demo reset button.
- Add seeded demo data.
- Add demo user.
- Add accessibility checks.
- Add end-to-end test.
- Write demo instructions.

### Demo Flow

```text
Sign in
    ↓
View dashboard
    ↓
Upload receipt
    ↓
Review mock extraction
    ↓
Confirm transaction
    ↓
See dashboard update
    ↓
Create invoice
    ↓
View outstanding payment
    ↓
Open loan-readiness report
    ↓
Preview e-invoice readiness
```

### Acceptance Criteria

- Demo can be completed without manual data fixes.
- Demo data can be reset.
- Mobile and desktop layouts work.
- No broken routes.
- No placeholder lorem ipsum.
- One end-to-end flow passes.
- README contains demo instructions.

### Codex Prompt

```text
Prepare the NiagaAI frontend for a hackathon demo.

Tasks:

- audit all routes
- fix inconsistent spacing and typography
- improve mobile responsiveness
- add loading skeletons
- add consistent empty and error states
- add toast feedback
- add demo reset action
- seed realistic Malaysian MSME data
- add one Playwright end-to-end test for:
  sign in → upload receipt → review → confirm → dashboard update
- document demo steps in README.md

Do not add backend integrations.
Do not implement AI.
Do not implement MyInvois.
Do not implement ElevenLabs.

Run linting, type checks, tests, and the end-to-end test.
Report all results.
```

---

## 24. Features Intentionally Deferred

The following are not part of this frontend-first phase:

- OpenAI receipt extraction
- OCR
- ElevenLabs speech-to-text
- ElevenLabs text-to-speech
- LHDN MyInvois API
- Real Supabase authentication
- Real database persistence
- WhatsApp Business integration
- Bank statement parsing
- CSV import processing
- Cash-flow forecasting
- AI-generated financial advice
- Real loan eligibility matching
- Databricks
- Production notifications
- PDF generation
- Email sending
- SMS sending

The UI should still contain sensible placeholders for selected future integrations where useful.

---

## 25. Testing Plan

### Component Tests

- Money formatting
- Transaction form validation
- Invoice total calculation
- Inventory quantity validation
- Status badges
- Empty states

### Page Tests

- Dashboard renders mock data
- Transaction list filters
- Receipt upload validation
- Invoice creation
- Mark payment as paid
- Loan-readiness disclaimer
- E-invoice demo state

### End-to-End Test

```text
Mock sign in
→ dashboard
→ receipt upload
→ simulated extraction
→ edit total
→ confirm
→ dashboard total changes
```

---

## 26. Frontend Definition of Done

The frontend phase is complete when:

1. All planned routes work.
2. App shell works on mobile and desktop.
3. User can enter through mock authentication.
4. User can complete onboarding.
5. Dashboard displays realistic data.
6. Transactions can be created, edited, saved, and confirmed locally.
7. Receipt upload simulation works.
8. Invoices and quotations can be created.
9. Outstanding payments can be updated.
10. Inventory can be managed locally.
11. Reports render from local data.
12. Loan-readiness UI is clearly indicative.
13. E-invoice readiness UI is clearly a demo.
14. Data can be reset.
15. Linting and type checks pass.
16. One end-to-end demo test passes.
17. No external AI or compliance API is required.

---

## 27. Immediate Next Action

Start by asking Codex to inspect the repository.

Use this prompt:

```text
Inspect the entire repository before making changes.

Read AGENTS.md if present, plan.md, README files, package manifests,
TypeScript configuration, Tailwind configuration, and all current routes,
components, utilities, and tests.

Create docs/frontend-repository-status.md containing:

- current project structure
- detected frontend framework and version
- package manager
- current routes
- current components
- current styling setup
- current state-management approach
- current test and lint setup
- missing frontend foundations
- risks
- recommended Phase 1 implementation

Do not install dependencies.
Do not restructure the repository.
Do not implement features.
Do not add backend code.
Do not add AI.

At the end, report:
- files inspected
- files created or changed
- unresolved issues
```

After the repository assessment, proceed to Phase 1: Design System and App Shell.
