# Supabase web repository migration

The web application retains an explicit two-adapter boundary. Supabase is the
default; demo persistence is enabled only by its explicit toggle:

- `NEXT_PUBLIC_AUTH_MODE=demo` uses browser-local repositories and deterministic fixtures.
- `NEXT_PUBLIC_AUTH_MODE=supabase` (or an omitted mode) uses typed Supabase business context and live repositories. A failed database write is surfaced to the UI; it never falls back to browser storage.

## Persistence inventory

| Area | Classification | Active behavior |
| --- | --- | --- |
| `Local*Repository` and `STORAGE_KEYS` business/transaction records | Server-persisted domain data in production | Kept only behind the explicit demo adapter. |
| `FRONTEND_STORAGE_KEYS` canonical migration collections | Compatibility/demo migration data | Retained during the parallel domain migration; do not use as a Supabase fallback. |
| Zustand onboarding step and active-business selection | Temporary UI state | Retained locally; active business is resolved against active memberships. |
| React Query cache | Cache | Retained and invalidated by business identity after writes. |
| `src/data/demo` fixtures and demo source inputs | Demo-only fixtures | Retained for the explicit demo experience and tests. |
| Invoices, payments, reminders | Server-persisted domain data | Supabase repositories and lifecycle RPCs in live mode; local adapters only in explicit demo mode. |

## Operational behavior

Transaction reads are scoped by `business_id`, use explicit selected columns, and expose a bounded page API (maximum 100 records). The legacy adapter preserves current UI DTOs while mapping through canonical transaction types. In Supabase mode, the adapter reads persisted records only; it does not seed fixtures. The remove operation maps to a deliberate void instead of a database delete.

The `20260716120000_web_transaction_audit.sql` migration stamps lifecycle actors, records a lifecycle-history row, and writes an audit event in the same database transaction as a transaction create, update, or void.

The current UI filter controls continue to run against the loaded page while the legacy screens are migrated. A subsequent UI slice can pass filters directly to `SupabaseTransactionRepository.listPage` without exposing query-builder objects to components.

## Manual verification

1. Configure Supabase mode and sign in as a business member in two browsers.
2. Create, edit, and void a transaction in one browser; confirm the other browser sees the persisted result after refresh.
3. Sign in to another business/account and confirm the first business records are unavailable.
4. Disconnect the database before a save and confirm the UI shows an error, with no local success state.
