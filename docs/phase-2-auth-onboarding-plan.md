# Phase 2 Plan — Mock Authentication and Onboarding

Status: Ready for implementation  
Prepared: 2026-07-13  
Depends on: Phase 1 frontend foundation

## 1. Outcome

Build a complete frontend-only first-time user journey for NiagaAI:

```text
Welcome → Sign in or Sign up → Business onboarding → Dashboard
```

The experience will use client-side validation and device-local persistence. It must look and behave like a real product flow while making no authentication, database, or external API calls.

## 2. Scope

### Included

- Public welcome page
- Mock sign-in form
- Mock sign-up form
- Shared authenticated-user state
- Business onboarding form
- Business-details review step
- Completion/success state
- Local persistence across refreshes
- Client-side route gating after persisted state has hydrated
- Sign-out action
- Demo-session reset action
- Responsive and accessible form states
- Focused validation and state tests

### Excluded

- Supabase or another authentication provider
- Server sessions, cookies, middleware authentication, or JWTs
- Password storage
- Backend routes or database writes
- Email verification and password recovery
- Social sign-in
- Multi-user or multi-business account switching
- AI, OCR, MyInvois, or other external integrations

## 3. Current Baseline

Phase 1 provides:

- Next.js App Router and strict TypeScript
- Tailwind CSS and NiagaAI design tokens
- Responsive `AppShell`
- Desktop sidebar, top bar, and mobile navigation
- Shared page header, metric card, money formatter, feedback states, and confirmation dialog
- A static dashboard-style preview at `/`

Phase 2 should preserve these components. The existing preview content will move to `/dashboard`; it should not be redesigned as part of this phase.

## 4. Implementation Decisions

These choices are fixed for Phase 2 to prevent avoidable implementation drift.

### Routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Public | Welcome page and primary entry point |
| `/login` | Public | Mock sign-in |
| `/signup` | Public | Create a local demo user |
| `/onboarding` | Signed-in user | Business form, review, and completion |
| `/dashboard` | Onboarded user | Existing Phase 1 application preview |

### State

Use one Zustand store with its `persist` middleware. Keep the store small and framework-agnostic.

Persist only:

- Sanitized demo user details
- Authentication boolean
- Business profile
- Onboarding-complete boolean
- Store schema version

Never persist:

- Passwords
- Password confirmation
- Form validation errors
- Temporary review-step state
- Loading or toast state

Use the storage key `niagaai-demo-session` and version the persisted schema from `1`.

### Forms

Use React Hook Form with Zod schemas and `@hookform/resolvers`. Keep schemas separate from page components so they can be reused and tested.

### Route Gating

Local storage is unavailable during server rendering, so route decisions must wait for store hydration.

- Show a full-page loading state while the persisted store hydrates.
- Unauthenticated access to `/onboarding` or `/dashboard` redirects to `/login`.
- Authenticated users without completed onboarding who open `/dashboard` redirect to `/onboarding`.
- Fully onboarded users who open `/login` or `/signup` redirect to `/dashboard`.
- Use `router.replace` so protected-route redirects do not create misleading back-button history.

This is a demo UX guard, not a security boundary. Document that distinction in code and README.

## 5. Dependencies

Add only:

```text
zustand
zod
react-hook-form
@hookform/resolvers
```

For focused automated tests, add:

```text
vitest
@testing-library/react
@testing-library/jest-dom
jsdom
```

Do not add TanStack Query, a component framework, an authentication SDK, or a backend client in this phase.

## 6. Proposed File Structure

```text
src/
├── app/
│   ├── page.tsx
│   ├── login/
│   │   └── page.tsx
│   ├── signup/
│   │   └── page.tsx
│   ├── onboarding/
│   │   └── page.tsx
│   └── dashboard/
│       └── page.tsx
├── components/
│   ├── auth/
│   │   ├── auth-card.tsx
│   │   ├── auth-gate.tsx
│   │   ├── sign-in-form.tsx
│   │   └── sign-up-form.tsx
│   ├── onboarding/
│   │   ├── business-form.tsx
│   │   ├── business-preview.tsx
│   │   ├── onboarding-progress.tsx
│   │   └── onboarding-success.tsx
│   └── forms/
│       ├── field-error.tsx
│       ├── form-field.tsx
│       └── select-field.tsx
├── lib/
│   └── validation/
│       ├── auth.ts
│       └── business.ts
├── store/
│   └── use-niaga-store.ts
└── types/
    ├── auth.ts
    └── business.ts
```

Tests should be colocated with the relevant schema, store, or component using `*.test.ts` and `*.test.tsx`.

## 7. Data Contracts

### Demo User

```ts
interface DemoUser {
  id: string;
  name: string;
  email: string;
}
```

Use a deterministic ID for the seeded demo user and a stable locally generated ID for a signed-up user. Do not introduce a UUID dependency.

### Business Profile

```ts
type BusinessType =
  | "food_beverage"
  | "retail"
  | "services"
  | "online_seller"
  | "other";

type PreferredLanguage = "en" | "ms";

interface BusinessProfile {
  name: string;
  type: BusinessType;
  registrationNumber: string;
  tin: string;
  currency: "MYR";
  preferredLanguage: PreferredLanguage;
}
```

Keep registration number and TIN optional for onboarding completion because many demo users may not have them immediately. Show them as recommended fields and preserve empty strings in the local model. The later e-invoice-readiness phase can flag them as incomplete.

### Store Actions

```ts
interface NiagaStoreActions {
  signIn: (email: string, name?: string) => void;
  signUp: (user: DemoUser) => void;
  saveBusiness: (business: BusinessProfile) => void;
  completeOnboarding: () => void;
  signOut: () => void;
  resetDemo: () => void;
  setHasHydrated: (value: boolean) => void;
}
```

`signOut` clears the active session but may retain the local business profile for the same demo device. `resetDemo` restores the entire persisted store to its initial state. Make this difference clear in confirmation copy.

## 8. Validation Rules

### Sign In

- Email is required and must be a valid email address.
- Password is required and must contain at least 8 characters.
- The password is used only to demonstrate form behavior and is never stored or compared with a backend record.
- Any validly shaped credentials succeed after a short deterministic simulated delay.

### Sign Up

- Name: 2–80 trimmed characters.
- Email: valid email address.
- Password: at least 8 characters, including one letter and one number.
- Confirm password: must match password.
- Terms checkbox: required, with clear demo-only wording.
- Password fields must be cleared after success and never enter global state.

### Business Onboarding

- Business name: 2–100 trimmed characters.
- Business type: one of the defined options.
- Registration number: optional, maximum 30 characters.
- TIN: optional, maximum 20 characters.
- Currency: fixed to MYR and shown as a disabled/read-only field.
- Preferred language: English or Bahasa Malaysia.
- Normalize whitespace before saving.

Validation errors appear next to the relevant field and the first invalid field receives focus after submit.

## 9. Screen Specifications

### Welcome Page

- NiagaAI brand and concise value proposition
- Primary action: `Get started`
- Secondary action: `Sign in`
- Three plain-language benefits: record sales and spending, understand cash flow, prepare better business records
- Clear `Demo experience` label
- Mobile-first layout without the authenticated app shell

### Sign-In Page

- Email and password fields
- Show/hide password control with accessible label
- Inline validation
- Submit loading state
- Link to sign up
- Demo-helper action that fills `lina@niagaai.demo`; it must not expose or persist a real credential
- On success: route to `/dashboard` when onboarding is complete, otherwise `/onboarding`

### Sign-Up Page

- Name, email, password, password confirmation, and demo terms checkbox
- Inline password requirements
- Submit loading and success feedback
- Link to sign in
- On success: create the local demo user and route to `/onboarding`

### Business Onboarding

Use two user-controlled steps and one completion state:

1. **Business details** — editable form.
2. **Review** — readable summary with `Edit details` and `Complete setup` actions.
3. **Success** — confirmation message followed by navigation to `/dashboard`.

Do not rely only on an automatic timed redirect. Provide a visible `Go to dashboard` action even if a short redirect is also used.

### Dashboard Integration

- Move the current Phase 1 page from `/` to `/dashboard`.
- Populate the greeting and business name from persisted state with safe demo fallbacks.
- Add a working sign-out action to the top bar.
- Add a reset-demo action in a clearly labelled menu or settings placeholder.
- Both destructive session actions use the existing confirmation dialog.

## 10. UX and Accessibility Requirements

- All fields have persistent visible labels; placeholders are supplementary only.
- Use correct `type`, `inputMode`, and `autoComplete` attributes.
- Associate error messages with fields using `aria-describedby`.
- Use `aria-invalid` only when a field has an error.
- Announce form-level success and failure messages with an appropriate live region.
- Preserve keyboard navigation and visible focus styles.
- Disable duplicate submission while a simulated action is in progress.
- Minimum touch target is 44 × 44 pixels.
- Respect reduced-motion preferences already defined in global styles.
- Keep Bahasa Malaysia as a saved preference only; full interface translation is deferred.

## 11. Persistence and Refresh Behavior

Document the following behavior in README:

- The demo session is stored only in the current browser using local storage.
- Refreshing preserves sign-in and onboarding progress after hydration.
- Clearing site data or choosing `Reset demo` removes the local session and business profile.
- Opening the app in another browser or device starts a separate demo session.
- Local persistence is for demonstration convenience and provides no real authentication security.

To avoid hydration mismatch or protected-content flashes, do not render route-dependent authenticated content until the store confirms hydration.

## 12. Error and Success States

Implement deterministic states rather than random failures.

- Field-level validation errors
- Form-level mock sign-in failure triggered only by the documented test email `error@niagaai.demo`
- Disabled submit button and progress copy during simulated submission
- Sign-in success message
- Account-created success message
- Business-profile saved message
- Onboarding-complete state
- Session-reset confirmation

Do not use random latency or random failures because the hackathon demo must be repeatable.

## 13. Implementation Sequence

### Step 1 — Tooling and Contracts

- Install approved form, validation, state, and test dependencies.
- Add test scripts and Vitest configuration.
- Add auth and business types.
- Add and test Zod schemas.

### Step 2 — Persistent Store

- Create the Zustand store and initial state.
- Add versioned persistence and hydration tracking.
- Implement sign-in, sign-up, business-save, completion, sign-out, and reset actions.
- Add store tests for state transitions and persisted-data exclusions.

### Step 3 — Public Auth Layout

- Add a reusable auth card/layout.
- Replace `/` with the welcome experience.
- Build sign-in and sign-up pages.
- Verify validation, loading, error, and success states.

### Step 4 — Onboarding

- Build the business-details form.
- Build the review step.
- Build the success state.
- Save only after explicit confirmation.

### Step 5 — Route Gating and Dashboard Integration

- Move the current preview to `/dashboard`.
- Add hydration-aware route gates.
- Connect the dashboard greeting and business name.
- Add sign-out and reset-demo flows.

### Step 6 — Verification and Documentation

- Run focused tests.
- Run lint, type checking, and production build.
- Check all five routes on mobile and desktop widths.
- Test refresh behavior at each route state.
- Update README with demo credentials, persistence behavior, and the complete Phase 2 flow.

## 14. Test Plan

### Unit Tests

- Sign-in schema accepts valid input and rejects malformed email/short password.
- Sign-up schema rejects mismatched passwords and missing terms acceptance.
- Business schema trims values and rejects unsupported types or languages.
- Store never persists a password field.
- Sign-out clears authentication state.
- Reset clears user, business, and onboarding state.
- Completing onboarding requires a saved business profile.

### Component Tests

- Sign-in shows accessible validation errors.
- Sign-up password confirmation works.
- Business form moves to review only when valid.
- Review step renders every saved business field.
- Auth gate renders loading state before hydration.

### Manual Route Matrix

| Session state | `/` | `/login` | `/onboarding` | `/dashboard` |
| --- | --- | --- | --- | --- |
| Signed out | Welcome | Sign in | Redirect to login | Redirect to login |
| Signed in, not onboarded | Welcome or continue action | Redirect to onboarding | Onboarding | Redirect to onboarding |
| Onboarded | Continue to dashboard | Redirect to dashboard | Redirect to dashboard | Dashboard |

### Required Verification Commands

```bash
npm run test
npm run lint
npm run typecheck
npm run build
```

The full Playwright demo flow remains scheduled for Phase 12. Do not add it prematurely unless Phase 2 route behavior proves too risky to cover with component tests.

## 15. Acceptance Checklist

- [ ] Welcome screen works on mobile and desktop.
- [ ] User can sign in through a deterministic mock flow.
- [ ] User can create a local demo account.
- [ ] Passwords never enter persisted or global state.
- [ ] User can enter and review business information.
- [ ] User can edit details from the review step.
- [ ] Completing onboarding routes to the dashboard.
- [ ] Refresh preserves the sanitized demo session.
- [ ] Hydration does not flash protected content.
- [ ] Route gating matches the route matrix.
- [ ] Dashboard uses the saved user and business names.
- [ ] Sign out works and is confirmed.
- [ ] Reset demo clears all device-local demo data and is confirmed.
- [ ] Error and success states are clear and accessible.
- [ ] No backend or external authentication request exists.
- [ ] Tests, lint, type checking, and production build pass.
- [ ] README documents mock behavior and refresh semantics.

## 16. Definition of Done

Phase 2 is complete when a new visitor can start at the welcome page, create or enter a demo account, complete and review their business profile, reach the dashboard, refresh without losing the sanitized local session, sign out, and reset the demo—without any network-backed authentication or database service.

## 17. Handoff to Phase 3

Phase 2 should leave Phase 3 with:

- A stable `DemoUser` contract
- A stable `BusinessProfile` contract
- A hydrated shared store ready to accept mock financial data
- A protected `/dashboard` route
- Working user/business identity in the application shell
- Reusable accessible form components

Phase 3 can then replace the dashboard’s static preview values with dedicated mock files and store-derived financial summaries without revisiting authentication architecture.
