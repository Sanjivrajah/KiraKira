# Web application

The web application is a Next.js 16 App Router project. Vercel runs the pages and Route Handlers; Supabase is the default identity and persistence layer. `NEXT_PUBLIC_AUTH_MODE=demo` switches authentication and ordinary financial repositories to an explicit browser-local adapter.

## Pages

| Route | Purpose | Status |
| --- | --- | --- |
| `/` | Public product entry | Available in both modes |
| `/login` | Supabase password/Google sign-in or demo sign-in | Available |
| `/signup` | Password or Google account creation | Available |
| `/auth/callback` | Server-side Supabase PKCE code exchange | Supabase mode |
| `/onboarding` | Business setup and review | Available |
| `/dashboard` | Cash summary, recent records, insights, and quick actions | Available |
| `/transactions` | Search, filter, inspect, edit, and void records | Available |
| `/transactions/new` | Manual, receipt, voice, CSV, bank statement, and demo WhatsApp capture | Available |
| `/transactions/[id]` | Transaction detail | Available |
| `/invoices` | Invoice list and status tracking | Available |
| `/invoices/new` | Multi-line invoice builder | Available |
| `/invoices/[id]` | Invoice detail | Available |
| `/invoices/[id]/edit` | Draft invoice editing | Available |
| `/e-invoices` | Prepare, approve, submit, and reconcile MyInvois documents | Supabase mode |
| `/voice` | ElevenLabs conversational assistant and transcript history | Provider configuration required |
| `/cash-flow` | Cash movement workspace | Available |
| `/loan-readiness` | Indicative assessment and loan-term simulation | Supabase mode |
| `/reminders` | Payment reminder queue and history | Available |
| `/settings` | Account, business, Telegram, appearance, regional, and MyInvois settings | Available |
| `/inventory` | Inventory placeholder | Not implemented |

Protected pages use `AuthGate`. In Supabase mode, the active business is selected from the signed-in user’s active memberships—the browser cannot establish access by inventing a business ID.

## Client composition

`src/app/layout.tsx` installs `AppProviders`, which creates the React Query client and then composes authentication, voice-agent, and theme providers. The frontend-storage migration runs once after the browser mounts so legacy demo records can be copied into versioned compatibility collections without affecting server rendering.

`AppShell` owns the authenticated layout. The primary navigation is defined in `src/components/layout/navigation.ts`; feature pages should not duplicate the shell or maintain a second route list.

## Authentication modes

### Supabase

Supabase is the default whenever `NEXT_PUBLIC_AUTH_MODE` is omitted or set to `supabase`. The browser uses the publishable key. Users can authenticate with email/password or the configured Google provider. Google OAuth returns through `/auth/callback`, where the server exchanges the PKCE code and stores the session in the existing cookie boundary. Server routes derive the caller from that cookie-backed Supabase session. Transactions, invoices, payments, reminders, business profiles, voice transcripts, and e-Invoice records are persisted to Supabase.

### Demo

Demo mode is selected only with:

```text
NEXT_PUBLIC_AUTH_MODE=demo
```

The mock auth service, Zustand session, deterministic fixtures, and local repositories keep data in the current browser. Demo mode does not simulate RLS, multi-device persistence, private evidence storage, e-Invoice submission, or production security.

## Transaction capture sources

| Source | Processing | Persistence boundary |
| --- | --- | --- |
| Manual | React Hook Form and Zod validation | Saved after review |
| Receipt image | Vercel validates JPG, PNG, or WEBP up to 10 MiB; OpenAI extracts fields | Extraction remains a draft |
| Voice note | Vercel validates audio up to 25 MiB; ElevenLabs transcribes; OpenAI structures | Transcript and fields remain a draft |
| CSV | Parsed deterministically in the browser, bounded to 100 rows | Each reviewed row is saved explicitly |
| Bank CSV | Parsed in the browser | Each reviewed row is saved explicitly |
| PDF bank statement | Vercel validates a PDF up to 15 MiB; OpenAI extracts transactions | Extracted transactions remain drafts |
| WhatsApp | Demonstration source only | No WhatsApp integration exists |

Every source converges on editable review. Provider success never means record confirmation.

## Query and mutation behavior

React Query keys live in `src/lib/query/query-keys.ts`. Hooks under `src/hooks` are responsible for invalidating related views after a mutation:

- transaction changes invalidate transaction lists, dashboard totals, and loan readiness;
- invoice changes invalidate invoice lists, reminders, and dashboard totals;
- e-Invoice changes invalidate the preparation or submission workspace;
- sign-out clears query data and temporary UI state before the auth session ends.

Components should not call repositories or `localStorage` directly.

## Voice assistant

The browser fetches a short-lived conversation token from `/api/voice/session`, then registers the client tools in `src/components/voice/client-tools.ts`. Sensitive tools stage a draft or pending action first; confirmation tools perform the write only after the owner agrees.

The matching ElevenLabs agent prompt and tool export are maintained in [voice-agent.md](voice-agent.md). A test verifies that the exported tool names exactly match the runtime tool map.

## Errors and route states

The dashboard has route-level loading and error states. The application also provides global error and not-found screens. Provider routes return bounded, user-facing failures and keep raw SDK errors out of responses. New data surfaces should preserve useful surrounding UI when one request fails and should cover loading, empty, error, and retry states.

## Browser-storage ownership

Browser storage is used for the explicit demo adapter, UI preferences, temporary state, and compatibility migration data. Storage keys belong in `src/lib/storage/storage-keys.ts` or the versioned frontend migration—not in components. Signing out and resetting demo data are different operations: sign-out ends the session; reset removes demo-owned records and preferences.
