# Financial insights and observability — implementation decision log

## Delivered boundary

`financial-insights.ts` provides typed, deterministic Telegram insight queries.
It operates only on owner-scoped confirmed transaction records, uses the
configured Malaysia timezone for default month ranges, excludes voided records,
limits category and recent-record outputs, and performs MYR arithmetic in code.
`/insights` and a small natural-language matcher use this layer; neither sends
financial figures to a model. The response states its period and that it is an
estimate from recorded transactions, not an audited statement.

The existing redacted orchestration runs and steps now support the
`financial_insight` capability. `agent-observability.ts` derives aggregates and
formats a safe timeline without raw prompts, transcripts, provider payloads, or
financial inputs. `/agent_trace` is deliberately available only outside
production and is scoped to the requesting Telegram user and chat.

## Actual schemas and persistence

- Confirmed Telegram records use `ConfirmedTransaction` (`status: confirmed`)
  and `transactionDate`; no raw drafts are queried.
- Local receivables use `Receivable.outstandingAmount`, excluding `voided`.
  The current Supabase Telegram persistence slice has no receivables adapter,
  so that one insight returns an explicit unavailable message there rather than
  reading a local file or claiming a zero balance.
- `20260717130000_financial_insights_orchestration.sql` extends the existing
  orchestration constraint for the new capability only. Existing trace tables,
  RLS, and redacted `input_summary` remain unchanged.

## Controls and follow-up

Provider timeout/retry limits live in `agent-config.ts`; the reusable wrapper
is explicitly for read-only provider calls, so retries cannot repeat a database
effect. The current explanation is deterministic, which is also the provider
failure fallback. Future optional natural-language explanation must send only
the aggregated insight DTO through that wrapper.

Confirmation and clarification rates are exposed as nullable when the current
run history does not contain those transitions; this avoids invented metrics.
Wire callback/clarification state transitions into the trace in a follow-up
before treating those rates as complete operational telemetry.

## Verification

- Focused Vitest coverage for insights, observability, provider controls, and
  orchestration passed (11 tests).
- `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`
  passed.
- The full `npm test` suite has one unrelated existing failure in
  `transaction-capture-flow.test.tsx`: its Session 3 assertion expects six
  input controls while the unmodified component renders five. All Session 6
  tests pass.
