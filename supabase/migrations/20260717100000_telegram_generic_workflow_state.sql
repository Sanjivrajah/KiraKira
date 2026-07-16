-- Session 3: retain the transaction draft compatibility fields while making the
-- active Telegram state an explicitly versioned workflow record.
alter table public.telegram_conversation_states
  add column workflow_id uuid,
  add column workflow_type text,
  add column workflow_version integer,
  add column workflow_status text,
  add column current_action_id text,
  add column collected_values jsonb not null default '{}'::jsonb check (jsonb_typeof(collected_values) = 'object');

update public.telegram_conversation_states
set workflow_id = gen_random_uuid(),
    workflow_type = 'transaction_capture',
    workflow_version = 1,
    workflow_status = case mode
      when 'awaiting_clarification' then 'awaiting_clarification'
      when 'awaiting_correction' then 'awaiting_clarification'
      when 'awaiting_review' then 'awaiting_confirmation'
      else 'routing'
    end
where workflow_id is null;

alter table public.telegram_conversation_states
  alter column workflow_id set not null,
  alter column workflow_type set not null,
  alter column workflow_version set not null,
  alter column workflow_status set not null,
  add constraint telegram_conversation_workflow_type_check check (workflow_type in ('transaction_capture')),
  add constraint telegram_conversation_workflow_version_check check (workflow_version = 1),
  add constraint telegram_conversation_workflow_status_check check (workflow_status in ('collecting_input', 'routing', 'awaiting_clarification', 'awaiting_confirmation', 'duplicate_warning', 'executing', 'completed', 'cancelled', 'expired', 'failed'));

create unique index telegram_conversation_states_workflow_id_unique on public.telegram_conversation_states (workflow_id);
