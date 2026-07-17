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

### Telegram orchestration boundary

The Telegram transport normalizes supported inbound transaction updates into a
small envelope and passes them to `TransactionOrchestrationService`. The
service records redacted run and step metadata, enforces inbound-update
idempotency, then invokes the existing transaction input or draft-confirmation
service. It does not own user-facing copy, Telegram SDK behavior, or financial
write rules. The existing explicit review and confirmation boundary remains the
only route to a confirmed financial record.

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
| Web voice text transcripts (Supabase mode) | `voice_conversations` + `voice_conversation_turns` | Signed-in speaker and active business | Private per user, no raw audio, 90-day retention target |
| API credentials | `.env.local` / runtime env | Server/process | Never expose or commit |
| Supabase evidence (prepared Session 4 boundary) | Private Storage + `evidence_files` metadata | Active business membership | Server-only orchestration; browser-local capture remains active until Session 5 |

## Private evidence storage boundary

`src/services/evidence/evidence-upload-service.ts` is the server-only path for
new Supabase evidence. It verifies the authenticated member and entity owner,
normalizes an allowed MIME/extension, hashes the bytes, generates a server
controlled `<business>/<entity>/<entity-id>/<uuid>.<ext>` object path, and
writes matching metadata. Buckets are private and their policies derive access
from the first path segment plus business membership; no public URL is issued.

The current receipt UI is intentionally not switched to this service until the
web repository migration. Evidence extraction remains queued/reviewable, never
becomes a confirmed transaction automatically, and provider payload retention
is not a reason to retain raw evidence forever. MIME/type checks are not
malware scanning; a scanning worker can be attached to the queue before moving
files from `queued` to `processing`. Deletion requests are soft-marked as
`delete_pending` for a scheduled cleanup worker, avoiding unaudited object
removal and orphaned metadata.

## Voice transcript storage boundary

The live web voice assistant keeps captions in browser memory for immediate
feedback. In Supabase mode, `app/api/voice/conversations` also writes the
signed-in speaker's text turns to `voice_conversations` and
`voice_conversation_turns`. RLS requires both the transcript owner and an
active membership in the selected business; coworkers cannot read one
another's transcripts merely because they share a business.

The app stores no call audio in this path. Provider conversation identifiers
are operational metadata, not user-facing content. Turns are upserted by their
session-local index because the voice provider can send progressively fuller
text for the same turn. Users can inspect and delete their recent history from
the voice page. Rows carry a 90-day `retention_delete_after` timestamp; a
deployment must run a scheduled cleanup job before claiming automatic expiry.
Transcript persistence never bypasses the existing explicit confirmation
boundary for transactions or invoices.

## Testing topology

Keep tests next to the seam they protect: pure domain/lib tests, repository and
service tests, component tests with accessible queries, route tests at HTTP
boundaries, and Telegram flow tests in `src/features/transaction-agent` and
`src/bot`. Mock providers at their boundaries, not inside business rules.
