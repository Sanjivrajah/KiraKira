# NiagaAI

NiagaAI is a mobile-first financial workspace concept for Malaysian micro-business owners. The current frontend demo includes a complete local-only first-time journey:

```text
Welcome → Sign in or Sign up → Business onboarding → Dashboard
```

## Current Scope

Phase 0 through Phase 2 of `plan_frontend_first.md` are complete.

- Responsive public welcome, sign-in, sign-up, onboarding, and dashboard routes
- React Hook Form and Zod validation with accessible field feedback
- A versioned Zustand session persisted to local storage
- Hydration-aware client route guards
- Business-details review and explicit completion state
- Dashboard identity populated from the saved demo profile
- Confirmed sign-out and full demo-reset actions
- Focused validation, store, and component tests

This phase makes no authentication, database, or external API calls. AI, OCR, MyInvois submission, and real financial records remain out of scope.

## Demo Access

Open `http://localhost:3000` after starting the app. You can create any valid demo account, or choose **Fill demo details** on the sign-in page to use:

```text
Email: lina@niagaai.demo
Password: demo1234
```

The password only demonstrates form validation. It is never compared with a server value, placed in global state, or persisted. The documented email `error@niagaai.demo` triggers the deterministic mock sign-in error.

## Local Persistence and Security

The sanitized demo session is stored only in the current browser under the local-storage key `niagaai-demo-session`.

- Refreshing preserves sign-in and onboarding progress after client hydration.
- Another browser or device starts with its own separate demo session.
- **Sign out** clears the active user session but retains the local business profile.
- **Reset demo** removes the local user, business profile, and onboarding progress.
- Clearing browser site data has the same effect as resetting the demo.

The route guards improve demo navigation only. Browser-local state is not a security boundary and does not provide real authentication or authorization.

## Requirements

- Node.js 20.9 or newer
- npm 10 or newer recommended

## Local Development

```bash
npm install
npm run dev
```

## Quality Checks

```bash
npm run test
npm run lint
npm run typecheck
npm run build
```

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Public welcome page |
| `/login` | Mock sign-in |
| `/signup` | Local demo account creation |
| `/onboarding` | Hydration-gated business setup and review |
| `/dashboard` | Hydration-gated Phase 1 application preview |

## Project Structure

```text
src/
├── app/                 # App Router pages and global styles
├── components/
│   ├── auth/            # Auth cards, forms, and route gate
│   ├── forms/           # Accessible shared form controls
│   ├── onboarding/      # Details, review, progress, and success
│   ├── dashboard/
│   ├── layout/
│   └── shared/
├── lib/validation/      # Reusable Zod schemas
├── store/               # Persisted Zustand demo session
└── types/               # Auth and business contracts
```
