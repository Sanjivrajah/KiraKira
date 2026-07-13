# Frontend Repository Status

Assessment date: 2026-07-13

## Summary

The repository is a clean starting point rather than an existing frontend application. It contains a short project README and the NiagaAI frontend-first build plan, but no application source, package manifest, framework configuration, or frontend tooling.

No existing product code needs to be preserved or migrated. Phase 1 should begin by establishing the smallest viable Next.js foundation and shared application shell.

## Files Inspected

- `README.md`
- `plan_frontend_first.md`
- Git status and recent Git history
- Repository file tree, including checks for `AGENTS.md`, package manifests, framework configuration, routes, components, utilities, and tests

No `AGENTS.md` file is present.

## Current Project Structure

```text
KiraKira/
├── .git/
├── README.md
└── plan_frontend_first.md
```

The plan file is currently untracked by Git. The active branch is `dev`, and the repository has one initial commit.

## Detected Frontend Framework and Version

No frontend framework is installed or configured.

- Next.js: not present
- React: not present
- TypeScript: not configured
- App Router: not present

Framework and dependency versions cannot be reported until the project is initialized.

## Package Manager

No package manager can be inferred because the repository has no `package.json` or lockfile.

For Phase 1, choose one package manager and commit its lockfile. `pnpm` is a sensible default for a new project, but the team should use `npm` instead if that is the hackathon environment standard.

## Available Scripts

None. There is no package manifest.

Phase 1 should establish at least:

- `dev`
- `build`
- `lint`
- `typecheck`
- `test`

## Current Routes

None. There is no `app/` or `pages/` directory.

## Current Components

None. There is no component library or shared component directory.

## Styling Setup

No styling system is configured.

- Tailwind CSS: not present
- Global stylesheet: not present
- Design tokens: not present
- shadcn/ui: not present

## State-Management Approach

No state-management approach is implemented.

The build plan recommends Zustand for shared local demo state. Phase 1 itself should avoid introducing product state until a shared-state requirement exists; a lightweight Zustand store can be added with the mock authentication or transaction work.

## Test and Lint Setup

No linting, formatting, type-checking, component-testing, or end-to-end-testing setup exists.

- ESLint: not configured
- Prettier: not configured
- TypeScript strict mode: not configured
- Vitest: not configured
- React Testing Library: not configured
- Playwright: not configured

## Missing Frontend Foundations

1. Next.js application using the App Router and TypeScript strict mode.
2. Package manifest, selected package manager, and committed lockfile.
3. Tailwind CSS and global design tokens.
4. Root layout, metadata, and global styles.
5. Responsive application shell with desktop and mobile navigation.
6. Accessible shared UI primitives for buttons, cards, badges, form controls, dialogs, and feedback states.
7. ESLint, formatting, and explicit type-check scripts.
8. Component-test foundation and a later Playwright setup for the demo flow.
9. Stable folders for types, mocks, store code, shared utilities, and reusable components.
10. Demo-data persistence and reset conventions.

## Risks

- **Scope risk:** The plan covers a full demo product. Implementing routes before the shared shell and data contracts would encourage duplication.
- **Dependency risk:** Installing the latest packages without pinning versions can introduce incompatibilities during a short hackathon.
- **State risk:** Local persistence needs a versioned schema and a reset path so stale browser data does not break the demo.
- **Responsive risk:** Desktop-first components could make the mobile demo difficult; shell behavior should be verified at mobile widths from Phase 1 onward.
- **Accessibility risk:** Custom dialogs and controls can omit keyboard and screen-reader behavior. Prefer established accessible primitives where a dependency is justified.
- **Compliance-language risk:** Loan-readiness and e-invoice screens must remain clearly indicative/demo-only, as required by the plan.
- **Testing risk:** Deferring all test setup until polish would make core local-state flows harder to stabilize.

## Recommended Phase 1 Implementation

Initialize a minimal Next.js application in the repository, then implement only the shared visual foundation:

1. Create a TypeScript-strict Next.js App Router project with Tailwind CSS.
2. Add global colors, typography, spacing, focus styles, and MYR-friendly number formatting.
3. Build a responsive `AppShell` with desktop sidebar, top bar, and mobile bottom navigation.
4. Add reusable `PageHeader`, `MetricCard`, `MoneyDisplay`, `LoadingState`, `EmptyState`, `ErrorState`, and accessible `ConfirmationDialog` components.
5. Add a neutral shell preview page using static placeholder content, without implementing dashboard features or authentication.
6. Configure and run linting, type checks, and a production build.
7. Document the chosen package manager and development commands in `README.md`.

## Recommended Next Task

Proceed with Phase 1: initialize the frontend toolchain and build the design system and application shell. Dependency installation is required for that phase and should happen only after choosing the package manager and versions.

## Unresolved Issues

- Package manager preference is not recorded.
- Required Node.js version is not recorded.
- Brand assets, logo, font choices, and final color palette are not supplied.
- It is not yet decided whether shadcn/ui should be initialized wholesale or whether only selected accessible primitives should be added.
- Hosting target and CI environment are not documented.
