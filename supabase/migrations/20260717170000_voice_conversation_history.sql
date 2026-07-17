-- Persist owner-visible voice transcripts without retaining raw audio.
-- Rows are marked for deletion after 90 days; a scheduled worker may hard-delete
-- rows once retention_delete_after has passed.
create table public.voice_conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider_conversation_id text not null check (char_length(provider_conversation_id) between 1 and 200),
  status text not null default 'active' check (status in ('active', 'completed', 'failed')),
  started_at timestamptz not null default public.current_timestamp_utc(),
  ended_at timestamptz,
  retention_delete_after timestamptz not null default (public.current_timestamp_utc() + interval '90 days'),
  created_at timestamptz not null default public.current_timestamp_utc(),
  updated_at timestamptz not null default public.current_timestamp_utc(),
  unique (user_id, provider_conversation_id),
  check (ended_at is null or ended_at >= started_at),
  check (retention_delete_after > started_at)
);

create table public.voice_conversation_turns (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.voice_conversations(id) on delete cascade,
  turn_index integer not null check (turn_index between 1 and 1000),
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(btrim(content)) between 1 and 8000),
  created_at timestamptz not null default public.current_timestamp_utc(),
  updated_at timestamptz not null default public.current_timestamp_utc(),
  unique (conversation_id, turn_index)
);

create index voice_conversations_owner_history_idx
  on public.voice_conversations (business_id, user_id, started_at desc);
create index voice_conversations_retention_idx
  on public.voice_conversations (retention_delete_after);
create index voice_conversation_turns_order_idx
  on public.voice_conversation_turns (conversation_id, turn_index);

create trigger voice_conversations_set_updated_at
  before update on public.voice_conversations
  for each row execute function public.set_updated_at();
create trigger voice_conversation_turns_set_updated_at
  before update on public.voice_conversation_turns
  for each row execute function public.set_updated_at();

alter table public.voice_conversations enable row level security;
alter table public.voice_conversation_turns enable row level security;

-- A transcript is private to the person who spoke it, even when several
-- people belong to the same business.
create policy voice_conversations_owner_select on public.voice_conversations
  for select to authenticated
  using (user_id = auth.uid() and public.is_business_member(business_id));
create policy voice_conversations_owner_insert on public.voice_conversations
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_business_member(business_id));
create policy voice_conversations_owner_update on public.voice_conversations
  for update to authenticated
  using (user_id = auth.uid() and public.is_business_member(business_id))
  with check (user_id = auth.uid() and public.is_business_member(business_id));
create policy voice_conversations_owner_delete on public.voice_conversations
  for delete to authenticated
  using (user_id = auth.uid() and public.is_business_member(business_id));

create policy voice_turns_owner_select on public.voice_conversation_turns
  for select to authenticated
  using (exists (
    select 1 from public.voice_conversations conversation
    where conversation.id = conversation_id
      and conversation.user_id = auth.uid()
      and public.is_business_member(conversation.business_id)
  ));
create policy voice_turns_owner_insert on public.voice_conversation_turns
  for insert to authenticated
  with check (exists (
    select 1 from public.voice_conversations conversation
    where conversation.id = conversation_id
      and conversation.user_id = auth.uid()
      and public.is_business_member(conversation.business_id)
  ));
create policy voice_turns_owner_update on public.voice_conversation_turns
  for update to authenticated
  using (exists (
    select 1 from public.voice_conversations conversation
    where conversation.id = conversation_id
      and conversation.user_id = auth.uid()
      and public.is_business_member(conversation.business_id)
  ))
  with check (exists (
    select 1 from public.voice_conversations conversation
    where conversation.id = conversation_id
      and conversation.user_id = auth.uid()
      and public.is_business_member(conversation.business_id)
  ));

revoke all on public.voice_conversations, public.voice_conversation_turns from anon;
grant select, insert, update, delete on public.voice_conversations to authenticated;
grant select, insert, update on public.voice_conversation_turns to authenticated;
