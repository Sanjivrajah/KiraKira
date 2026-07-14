# AGENTS.md

Instructions for agents and contributors working in this Next.js application.

## Source of truth

This repository uses Next.js 16 with the App Router. Do not rely on remembered Next.js APIs: this version contains breaking changes and deprecations.

Before changing framework behavior, read the relevant installed guide under `node_modules/next/dist/docs/01-app/`. Treat those installed docs and the repository's existing patterns as authoritative. Never edit files in `node_modules`.

Useful starting points:

- `01-getting-started/02-project-structure.md`
- `01-getting-started/05-server-and-client-components.md`
- `01-getting-started/06-fetching-data.md`
- `01-getting-started/07-mutating-data.md`
- `01-getting-started/08-caching.md`
- `01-getting-started/10-error-handling.md`
- `02-guides/data-security.md`
- `02-guides/production-checklist.md`
- `02-guides/testing/`

## Required verification

Run the checks appropriate to the change before handing it off:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

- Run focused tests while iterating, then the full relevant suite.
- Treat warnings, hydration errors, console errors, and failed network requests as defects unless explicitly documented.
- If an existing failure is unrelated, prove it exists on the base branch and report it separately. Do not conceal or casually fix unrelated failures.
- For UI work, verify at minimum a narrow mobile viewport, a tablet viewport, and a desktop viewport. Check keyboard use, 200% zoom, long text, empty data, loading, and error states.

## App Router architecture

- Use the App Router conventions under `src/app`.
- Pages and layouts are Server Components by default. Keep them server-side unless they genuinely need state, effects, event handlers, custom client hooks, or browser-only APIs.
- Put `"use client"` at the smallest interactive boundary. Everything imported by a Client Component joins the client module graph, so do not mark whole pages or layouts as client components for convenience.
- Client Component props must be serializable. Pass minimal DTOs rather than database rows, SDK objects, errors, class instances, or secrets.
- Compose Server Components into Client Components through `children` or other render props when that preserves a smaller client bundle.
- Use route groups and private folders to organize code without changing public URLs. Colocate route-specific code; move genuinely shared code to `src/components`, `src/lib`, or the relevant domain module.
- Use layouts for shared UI and persistent navigation. Do not duplicate shells across pages.
- In Next.js 16, confirm the installed signatures before using request APIs. Route `params`, page `searchParams`, `cookies()`, and `headers()` may be asynchronous.
- Use `proxy.ts` only for request-boundary concerns supported by the installed Next.js version. Authentication and authorization must still be enforced where data is read or mutated.

## Navigation and route states

- Use `next/link` for internal navigation. Use `useRouter` only when navigation is triggered imperatively by application logic.
- Prefer semantic URLs and URL search parameters for shareable filter, sort, pagination, and tab state.
- Add `loading.tsx` or focused `Suspense` boundaries for slow route segments. Keep useful surrounding UI interactive while one section loads.
- Add accessible `error.tsx`, `not-found.tsx`, and global recovery UI where appropriate. Error screens must explain what happened, preserve user trust, and offer a recovery action.
- Do not expose stack traces, provider messages, secrets, or internal identifiers in user-facing errors.
- Redirect and not-found helpers terminate control flow; do not swallow them in broad `catch` blocks.

## Data fetching, caching, and mutations

- Fetch server-owned data directly from Server Components or a server-only data layer. Do not call this app's Route Handlers from Server Components; that adds an unnecessary HTTP hop.
- Fetch independent resources in parallel. Avoid sequential waterfalls unless one request depends on another.
- Decide caching deliberately for every server data source. Do not assume a request is cached or uncached; confirm the behavior in the installed caching guide.
- Keep cache scope, lifetime, tags, and invalidation close to the data function. After a mutation, invalidate or update exactly the affected data.
- Use streaming for slow, independent sections rather than blocking the entire page.
- Use Server Actions for application-owned mutations when appropriate; use Route Handlers for public HTTP boundaries, callbacks, uploads, integrations, or endpoints consumed by clients.
- Treat every Server Action and Route Handler as a public endpoint. Authenticate, authorize, validate, rate-limit expensive work, and return safe errors inside each operation.
- Validate all external input on the server, even when the client already validates it. Prefer shared Zod schemas and inferred TypeScript types.
- Prevent duplicate submissions and make mutation outcomes explicit. Preserve user input when recoverable errors occur.

## Security and privacy

- Put secrets only in server environment variables. Only values intentionally safe for browsers may use the `NEXT_PUBLIC_` prefix.
- Never commit `.env`, credentials, production data, customer records, access tokens, or uploaded financial documents.
- Import `server-only` in modules that access secrets, privileged SDKs, databases, or sensitive business logic.
- Prefer a server-only Data Access Layer that performs authorization and returns minimal DTOs.
- Never pass whole user, business, transaction, bank, or invoice records to the client when only a subset is needed.
- Sanitize uploaded filenames and validate file type, content, and size on the server. Do not trust MIME types or extensions alone.
- Avoid logging receipt contents, bank statements, voice transcripts, tokens, personal identifiers, or raw provider payloads.
- Escape output by default and avoid `dangerouslySetInnerHTML`. If raw HTML is unavoidable, sanitize it with an approved server-side policy.
- Consider CSP, secure cookies, CSRF protections where relevant, and rate limits for AI/provider endpoints before production.

## Components and TypeScript

- Keep components focused on one responsibility. Separate data access, domain transformation, and presentation when they change for different reasons.
- Prefer composition over large boolean-driven components.
- Reuse established primitives for fields, dialogs, loading, errors, empty states, money, and page headers.
- Use strict types. Avoid `any`, non-null assertions, broad casts, and duplicated handwritten types when schemas or domain types can infer them.
- Model finite states with discriminated unions. Make impossible UI states unrepresentable where practical.
- Keep domain calculations in pure functions and test boundary values, currency rounding, dates, and invalid inputs.
- Never mutate props, query results, or shared state in place.
- Use stable IDs for list keys. Do not use array indexes when items can be inserted, removed, filtered, or reordered.

## React behavior

- Calculate derived values during rendering rather than synchronizing them into state with an effect.
- Use effects only to synchronize with external systems. Clean up timers, subscriptions, observers, object URLs, and event listeners.
- Do not suppress hook dependency warnings. Stabilize callbacks or restructure the effect.
- Avoid hydration mismatches: do not read `window`, `localStorage`, time, randomness, or locale-dependent browser state during server rendering without an intentional client boundary and stable initial UI.
- Use transitions for non-urgent updates when they materially improve responsiveness. Do not add memoization without evidence from profiling or a clear expensive computation.

## UI, accessibility, and resilience

- Use semantic HTML first; add ARIA only when native semantics are insufficient.
- Every control needs an accessible name. Every form error must be associated with its field. Dynamic success and error feedback must be announced appropriately.
- All functionality must work with a keyboard. Dialogs must trap focus, close with Escape, restore focus, and prevent background interaction.
- Maintain WCAG AA contrast and visible focus. Do not communicate status through color alone.
- Touch targets must be at least 44×44 CSS pixels.
- Design mobile-first and verify there is no horizontal page overflow at supported breakpoints.
- Allow text expansion and unbroken user content: use `min-width: 0`, wrapping, truncation only when loss is acceptable, and logical CSS properties for RTL readiness.
- Respect `prefers-reduced-motion`, safe-area insets, browser zoom, and dynamic viewport units.
- Every data surface needs intentional loading, empty, partial, error, offline, and retry behavior. One failed widget should not unnecessarily block an entire screen.
- Disable or guard pending actions to prevent double submission, but keep recovery and cancellation available when safe.
- Use `Intl.DateTimeFormat` and `Intl.NumberFormat` for user-facing dates, numbers, and MYR currency. Do not hand-build locale formatting.
- Preserve the existing Niaga design language and `.impeccable.md` guidance. Do not introduce generic AI-dashboard styling.

## Images, fonts, scripts, and performance

- Use `next/image` for content images unless a documented exception applies. Provide meaningful `alt` text, or empty `alt` for decorative images, and always prevent layout shift with known dimensions or `fill` plus a sized parent.
- Use `next/font` for application fonts. Do not add render-blocking remote font stylesheets.
- Use `next/script` for third-party scripts and choose the least disruptive loading strategy.
- Keep static assets in `public` and reference them from the root path.
- Lazy-load large client-only components and provider SDKs when they are not required for initial interaction.
- Avoid adding dependencies for functionality that the platform, React, or existing dependencies already provide. Check bundle impact before adding large packages.
- Keep images, uploads, and API responses bounded. Paginate or virtualize large datasets instead of rendering unbounded lists.

## Metadata

- Use the Metadata API for titles, descriptions, canonical information, and social previews. Do not manually add duplicate `<head>` tags.
- Give important routes specific, human-readable titles and descriptions.
- Add robots and sitemap behavior intentionally before public deployment; do not expose private application routes to indexing accidentally.

## Testing

- Test behavior rather than implementation details. Prefer accessible queries such as role, label, and visible name.
- Unit-test pure domain logic, schemas, parsers, and synchronous components with Vitest.
- Use integration tests for forms, storage/data hooks, Route Handlers, and mutation/error flows.
- Use browser E2E tests for async Server Components, routing, hydration, authentication boundaries, uploads, and critical user journeys.
- Every bug fix should include a regression test at the seam that reproduces the bug when such a seam exists.
- Include malformed, empty, oversized, duplicate, long-text, Unicode, locale, network-error, and rapid-repeat cases where relevant.
- Mock at external boundaries, not inside the unit being tested. Keep fixtures minimal and free of real personal or financial data.

## Code quality and scope

- Keep changes small and aligned with the requested task. Preserve unrelated user changes.
- Follow existing naming, import aliases, file organization, and formatting.
- Remove dead code, debug logs, temporary fixtures, screenshots, and commented-out experiments before handoff.
- Comments should explain why a constraint exists, not narrate obvious code.
- Prefer atomic Conventional Commits: one independently understandable logical change per commit.
