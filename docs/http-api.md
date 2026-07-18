# HTTP API

The HTTP surface is implemented with Next.js Route Handlers under `src/app/api`. These routes exist for browser uploads, authenticated server operations, and scheduled work—not as a versioned public API for third-party clients.

## Endpoint inventory

| Method and route | Access | Purpose |
| --- | --- | --- |
| `POST /api/audio/transcribe` | No session check in the handler | Validate audio, transcribe with ElevenLabs, and structure one transaction with OpenAI |
| `POST /api/vision/receipts` | No session check in the handler | Validate one receipt image and return structured extraction |
| `POST /api/imports/bank-statement` | No session check in the handler | Validate one PDF and return proposed transactions |
| `POST /api/data-migrations/browser-local` | Signed-in member with write role | Preview or commit an explicit browser-local transaction import |
| `GET /api/health/supabase` | Development only | Report demo mode or Supabase reachability; returns 404 in production |
| `GET /api/loan-readiness` | Signed-in business member | Calculate current indicative readiness from persisted transactions |
| `POST /api/loan-readiness` | Signed-in business member | Run a non-persisted loan-term simulation |
| `GET /api/telegram/link-code` | Signed-in eligible member | List businesses that can be linked to Telegram |
| `POST /api/telegram/link-code` | Signed-in eligible member | Issue a short-lived one-time link code; only its digest is stored |
| `GET /api/voice/session` | Signed in for Supabase mode; demo token otherwise | Mint a short-lived ElevenLabs conversation token |
| `GET /api/voice/conversations` | Transcript owner in Supabase mode | List recent private transcript history for one business |
| `POST /api/voice/conversations` | Signed-in business member | Start a transcript record |
| `PUT /api/voice/conversations` | Transcript owner through RLS | Upsert one progressively streamed text turn |
| `PATCH /api/voice/conversations` | Transcript owner | Mark a conversation completed or failed |
| `DELETE /api/voice/conversations` | Transcript owner | Delete a conversation and its turns |
| `GET /api/e-invoices` | Signed-in business member | Load candidates and preparation revisions |
| `POST /api/e-invoices` | Owner, admin, or accountant; approval is owner/admin only | Prepare, edit fields, approve, or create a correction revision |
| `POST /api/e-invoices/connections` | Owner, admin, or accountant | Configure sandbox metadata or test a sandbox/production OAuth connection |
| `GET /api/e-invoices/submissions` | Signed-in business member | Load candidates, history, attention items, and connection state |
| `POST /api/e-invoices/submissions` | Owner or admin; recent sign-in for high-risk actions | Generate, preview, submit, refresh, or cancel MyInvois records |
| `GET /api/e-invoices/operations` | Owner, admin, or accountant | Read connection state, operation events, and dead letters |
| `POST /api/e-invoices/operations` | Database-gated administrative role with recent sign-in | Mark sandbox verified, activate production, or disable production |
| `POST /api/internal/e-invoices/status-sync` | Bearer secret | Reconcile all due MyInvois submissions from a trusted scheduler |

## Upload limits

| Route | Accepted input | Limit |
| --- | --- | --- |
| `/api/vision/receipts` | JPG, PNG, or WEBP image | 10 MiB |
| `/api/audio/transcribe` | AAC, FLAC, M4A, MP3, OGG, OPUS, WAV, or WEBM | 25 MiB and a 6,000-character transcript |
| `/api/imports/bank-statement` | PDF with a valid `%PDF-` signature | 15 MiB |

The Telegram worker has its own receipt and voice limits because it downloads Telegram files outside these web routes.

## Authentication and authorization

Authenticated handlers create a request-scoped Supabase server client and derive the user from the session cookie. A supplied `userId` is never accepted as identity. Business routes then check active membership and the role required by the action; RLS and database functions repeat the tenant boundary.

The three extraction handlers currently do not perform a session check. Production exposure should therefore be protected with the platform’s request controls and an application rate-limit before treating them as abuse-resistant public endpoints.

The internal status route compares the complete `Authorization` header with `Bearer ${EINVOICE_STATUS_SYNC_SECRET}`. It uses the service role to claim due jobs and must not be linked from the UI.

## Response behavior

- JSON error bodies use an `error` field with a safe, actionable message.
- Routes handling private or mutable data return `Cache-Control: no-store`.
- Provider response bodies, access tokens, service errors, unsigned payloads, and uploaded evidence are not returned to the browser.
- Validation failures are 4xx responses; provider availability failures use bounded 5xx responses.
- e-Invoice conflicts use immutable revision and idempotency checks rather than last-write-wins updates.

When adding an endpoint, document its method, caller, role, cache behavior, request limit, and persistence effect here in the same change.
