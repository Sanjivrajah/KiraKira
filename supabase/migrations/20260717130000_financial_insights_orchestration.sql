-- Session 6 adds a read-only capability to the existing redacted trace model.
alter table public.agent_orchestration_runs drop constraint if exists agent_orchestration_runs_routed_intent_check;
alter table public.agent_orchestration_runs add constraint agent_orchestration_runs_routed_intent_check check (routed_intent in ('transaction_capture', 'financial_insight'));
alter table public.agent_orchestration_steps drop constraint if exists agent_orchestration_steps_intent_check;
alter table public.agent_orchestration_steps add constraint agent_orchestration_steps_intent_check check (intent in ('transaction_capture', 'financial_insight'));
