-- Session 1 orchestration records are deliberately redacted traces. Financial
-- drafts and confirmations remain in the existing Telegram workflow tables.
create table public.agent_orchestration_runs (
  id uuid primary key default gen_random_uuid(),
  telegram_account_id uuid not null references public.telegram_accounts(id) on delete cascade,
  telegram_user_id bigint not null,
  telegram_chat_id bigint not null,
  source_update_id text not null,
  source_message_id text not null,
  idempotency_key text not null unique,
  input_kind text not null check (input_kind in ('text', 'voice', 'receipt_image', 'callback')),
  locale text not null check (locale in ('en', 'ms')),
  input_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(input_summary) = 'object'),
  status text not null check (status in ('received', 'routing', 'awaiting_clarification', 'awaiting_confirmation', 'executing', 'completed', 'cancelled', 'failed')),
  routed_intent text check (routed_intent in ('transaction_capture')),
  outcome text check (outcome in ('processed', 'duplicate', 'failed')),
  failure_code text check (failure_code in ('provider_unavailable', 'invalid_input', 'persistence_failed', 'unexpected')),
  started_at timestamptz not null default public.current_timestamp_utc(),
  completed_at timestamptz,
  created_at timestamptz not null default public.current_timestamp_utc(),
  updated_at timestamptz not null default public.current_timestamp_utc(),
  check ((completed_at is null) or completed_at >= started_at)
);
create index agent_orchestration_runs_active_account_idx on public.agent_orchestration_runs (telegram_account_id, updated_at desc) where status not in ('completed', 'cancelled', 'failed');
create index agent_orchestration_runs_source_update_idx on public.agent_orchestration_runs (telegram_account_id, source_update_id);

create table public.agent_orchestration_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_orchestration_runs(id) on delete cascade,
  sequence integer not null check (sequence > 0),
  step_key text not null check (length(step_key) <= 80),
  intent text not null check (intent in ('transaction_capture')),
  status text not null check (status in ('started', 'completed', 'failed', 'skipped')),
  provider text check (provider in ('openai', 'elevenlabs')),
  error_code text check (error_code in ('provider_unavailable', 'invalid_input', 'persistence_failed', 'unexpected')),
  duration_ms integer check (duration_ms >= 0),
  started_at timestamptz not null default public.current_timestamp_utc(),
  completed_at timestamptz,
  created_at timestamptz not null default public.current_timestamp_utc(),
  updated_at timestamptz not null default public.current_timestamp_utc(),
  unique (run_id, sequence),
  check ((completed_at is null) or completed_at >= started_at)
);
create index agent_orchestration_steps_run_idx on public.agent_orchestration_steps (run_id, sequence);

create trigger agent_orchestration_runs_set_updated_at before update on public.agent_orchestration_runs for each row execute function public.set_updated_at();
create trigger agent_orchestration_steps_set_updated_at before update on public.agent_orchestration_steps for each row execute function public.set_updated_at();

alter table public.agent_orchestration_runs enable row level security;
alter table public.agent_orchestration_steps enable row level security;
create policy agent_orchestration_runs_member_read on public.agent_orchestration_runs for select to authenticated using (public.is_telegram_member(telegram_account_id));
create policy agent_orchestration_steps_member_read on public.agent_orchestration_steps for select to authenticated using (exists (select 1 from public.agent_orchestration_runs runs where runs.id = run_id and public.is_telegram_member(runs.telegram_account_id)));
grant select on public.agent_orchestration_runs, public.agent_orchestration_steps to authenticated;
grant select, insert, update on public.agent_orchestration_runs, public.agent_orchestration_steps to service_role;
