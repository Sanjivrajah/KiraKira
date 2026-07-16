# Engineering conventions

This guide records repository-specific patterns. `AGENTS.md` remains the
mandatory source for framework, security, accessibility, and verification
requirements.

## Choose the right layer

| Change | Preferred home |
| --- | --- |
| Route, metadata, loading/error boundary, public HTTP endpoint | `src/app` |
| Interactive or feature presentation | `src/components/<feature>` |
| Client query/mutation coordination | `src/hooks` |
| UI-facing business operation | `src/services` |
| Storage contract or adapter | `src/repositories` |
| Canonical financial rule, schema, calculation | `src/domain` |
| Canonical-to-UI translation or browser migration | `src/frontend` |
| Provider client, format/parser, validation, local utility | `src/lib` |
| MyInvois rule/mapping/reference data | `src/compliance/myinvois` |
| Telegram use case/state machine | `src/features/transaction-agent` |
| Telegram transport, copy, keyboards, startup | `src/bot` |

Avoid importing in the reverse direction: domain code should not import React,
browser storage, Telegram, or provider SDKs; components should not implement
financial calculations or direct persistence.

## Data and validation

- Use Zod schemas at input and persistence boundaries. Infer types from schemas
  where practical instead of duplicating interfaces.
- Canonical monetary values are decimal strings, not JavaScript floats. Use the
  existing domain calculation helpers for canonical amounts and tax totals.
- Keep `src/types` legacy UI contracts stable while migration is active. Place
  conversion logic in a named adapter or `src/frontend/view-models`.
- Give IDs and timestamps to service/domain creation paths, not presentation
  components.
- User-facing money and dates use the existing `Intl`-based format helpers.

## React and Next.js

- App Router pages are server-side unless they genuinely need browser state or
  handlers. Put `"use client"` at the smallest interactive boundary.
- Check the installed Next.js 16 docs before changing `params`, `searchParams`,
  cache behavior, request APIs, or server/client boundaries.
- Use `next/link` for internal navigation. Prefer URL state for shareable
  filters, sorts, tabs, and pagination.
- Derive render values during render. Effects are for external synchronization
  such as the existing frontend-storage migration or persisted-session hydrate.
- Use React Query keys from `src/lib/query/query-keys.ts`; invalidate all
  dependent views after a local mutation.

## Browser-local web persistence

- Use repository contracts, services, and hooks instead of accessing
  `localStorage` from components.
- Add storage keys only in `src/lib/storage/storage-keys.ts` (legacy) or
  `src/frontend/storage/migration.ts` (canonical migration collections).
- Treat malformed local data as recoverable: parser/repository reads should
  ignore invalid records safely rather than break an entire screen.
- `signOut` and `resetDemo` are distinct: sign-out removes the active session;
  reset removes all demo-owned browser data.

## External services and errors

- Provider SDK calls live behind focused modules in `src/lib/openai`,
  `src/lib/elevenlabs`, `src/lib/telegram`, or an equivalent integration layer.
- Validate external input before calling a provider. Keep API Route Handlers as
  the safe HTTP boundary and return generic, actionable error copy.
- Never log credentials, full evidence payloads, transcripts, or raw provider
  responses. Never put server secrets in `NEXT_PUBLIC_*` variables.
- Extraction produces a draft/proposal. Persist confirmed financial records
  only after an explicit owner action.

## Testing and verification

- Name tests after observable behavior. Use accessible UI queries and mock at
  external boundaries.
- Add a regression test at the seam for each fix: parser/schema, service,
  component, Route Handler, or Telegram flow as appropriate.
- Before handoff run:

  ```bash
  npm run lint
  npm run typecheck
  npm test
  npm run build
  git diff --check
  ```

- For UI changes, also verify narrow mobile, tablet, and desktop layouts plus
  keyboard navigation, 200% zoom, long text, empty/loading/error states.

## Documentation maintenance

Update the relevant document in this folder when a change alters a boundary,
storage contract, source-of-truth layer, supported user workflow, environment
variable, or command. Keep README-level documentation user-facing; keep these
guides factual and implementation-oriented.
