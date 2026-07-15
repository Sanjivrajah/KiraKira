# Architecture

## System shape

```text
                        ┌────────────────────────┐
                        │      PRODUCT.md         │
                        │ product promises/scope  │
                        └────────────┬───────────┘
                                     │
                 ┌──────────────────┴──────────────────┐
                 │                                     │
       ┌─────────▼─────────┐                 ┌─────────▼──────────┐
       │ Next.js web app   │                 │ Telegram agent      │
       │ App Router        │                 │ grammY long polling │
       └─────────┬─────────┘                 └─────────┬──────────┘
                 │                                     │
     routes → components → hooks → services      bot → input processor
                                  → repositories       → draft service
                                  → browser storage    → local JSON stores
                 │                                     │
        canonical view models/storage migration   OpenAI extraction +
                 │                                ElevenLabs transcription
       src/domain + src/compliance
```

The web app and Telegram agent intentionally have separate persistence and
transaction contracts today. Do not silently join them or assume that a bot
record is visible in the web dashboard.

## Web application layers

### Routes and UI

`src/app` owns App Router pages, layouts, route-level loading/error states,
and public HTTP boundaries under `src/app/api`. Pages are Server Components by
default. Keep browser state, effects, handlers, local storage, and React Query
inside the smallest suitable client component.

`src/components` renders feature UI. Shared controls belong in
`components/shared` or `components/forms`; feature-specific UI stays in its
feature folder. Components should receive display-ready data and callbacks,
not reach into browser storage directly.

### Client data path

For the current local-first web experience, use this path:

```text
component → hook → service → repository contract → local repository → localStorage
```

- `src/hooks` is the React Query boundary. Mutations must invalidate every
  affected query key (for example, transaction changes also affect dashboard
  and loan-readiness data).
- `src/services` coordinates IDs, timestamps, fixtures, and related
  repositories. It is the UI-facing use-case layer.
- `src/repositories/contracts` defines storage-independent interfaces.
- `src/repositories/local` implements them against `KeyValueStorage` with
  parsing, deduplication, and business scoping.
- `src/lib/storage/storage-keys.ts` is the source of truth for legacy web
  local-storage keys. Do not scatter string keys through UI code.

The `services` singleton is appropriate only for browser-local demo behavior.
Server-owned persistence should be introduced behind server-only data access,
not by importing browser-local services into server code.

### Canonical domain migration

`src/domain` is the canonical financial model: Zod schemas, branded IDs,
decimal-string money, audit metadata, calculations, and domain-specific types.
It intentionally runs in parallel with the older UI contracts in `src/types`
and browser-local repositories.

`src/frontend/view-models` is the translation boundary between UI forms and
canonical domain records. `src/frontend/storage/migration.ts` copies legacy
browser records into versioned canonical collections. During this staged
migration:

- preserve existing legacy keys and UI behavior;
- convert at adapters/view models rather than changing every consumer at once;
- make migrations repeatable and report malformed legacy records rather than
  crashing;
- increment `FRONTEND_DATA_VERSION` only with a compatible migration path.

`src/compliance/myinvois` consumes canonical commercial-document models for
validation, mapping, UBL output, and reference data. It is not proof of a live
submission or official approval.

### External extraction boundaries

Route Handlers validate raw input, call focused providers under `src/lib`, and
return safe messages. They do not persist a financial record. Examples:

- receipt images: `app/api/vision/receipts` → `lib/openai/receipt-extraction`;
- voice transcription: `app/api/audio/transcribe` → ElevenLabs then OpenAI;
- bank statements: `app/api/imports/bank-statement` → OpenAI extraction.

Validate file type, size, and request shape at the route boundary. Catch
provider-specific errors there, log only safe operational details, and return
user-facing errors without provider payloads, stack traces, or evidence.

## State and persistence boundaries

| Surface | Storage | Owner | Important rule |
| --- | --- | --- | --- |
| Web demo session and records | Browser `localStorage` | Current browser | Not an auth/security boundary |
| Canonical web migration data | Versioned browser keys | Current browser | Retain legacy data during migration |
| Telegram drafts, records, conversation state | JSON files in `LOCAL_DATA_DIRECTORY` | Local bot process | Never auto-delete corrupt data |
| API credentials | `.env.local` / runtime env | Server/process | Never expose or commit |

## Testing topology

Keep tests next to the seam they protect: pure domain/lib tests, repository and
service tests, component tests with accessible queries, route tests at HTTP
boundaries, and Telegram flow tests in `src/features/transaction-agent` and
`src/bot`. Mock providers at their boundaries, not inside business rules.
