# NiagaAI

NiagaAI is a mobile-first financial workspace concept for Malaysian micro-business owners. This repository currently contains the frontend foundation for the hackathon demo: a responsive application shell, shared UI components, and realistic static preview data.

## Current Scope

Phase 0 and Phase 1 of `plan_frontend_first.md` are complete.

- Repository baseline documented in `docs/frontend-repository-status.md`
- Next.js App Router with strict TypeScript
- Tailwind CSS design tokens and responsive layout
- Desktop sidebar, top bar, and mobile bottom navigation
- Reusable page header, metric card, money display, loading, empty, error, and confirmation components
- Static NiagaAI foundation preview using Malaysian MSME sample content

Authentication, product routes, persistent state, backend integrations, AI, OCR, and MyInvois submission are intentionally not implemented yet.

## Requirements

- Node.js 20.9 or newer
- npm 10 or newer recommended

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Quality Checks

```bash
npm run lint
npm run typecheck
npm run build
```

## Project Structure

```text
src/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
└── components/
    ├── dashboard/
    ├── layout/
    └── shared/
```

## Next Step

Proceed to Phase 2 in `plan_frontend_first.md`: mock authentication and business onboarding with validation and local persistence.
