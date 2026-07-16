-- Session 7: keep Telegram identity, state, replay protection, and confirmation
-- together in the database. The bot uses these RPCs only after it has identified
-- the Telegram user/chat; service_role is not an authorization substitute.
alter table public.telegram_conversation_states add column draft_id uuid;
update public.telegram_conversation_states set draft_id = (draft ->> 'id')::uuid where draft_id is null and draft ? 'id';
alter table public.telegram_conversation_states alter column draft_id set not null;
create unique index telegram_conversation_states_draft_id_unique on public.telegram_conversation_states (draft_id);
alter table public.telegram_conversation_states add column version integer not null default 0 check (version >= 0);

create table public.telegram_link_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  code_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default public.current_timestamp_utc(),
  check (expires_at > created_at)
);
create index telegram_link_codes_active_idx on public.telegram_link_codes (code_hash, expires_at) where consumed_at is null and revoked_at is null;
alter table public.telegram_link_codes enable row level security;
create policy telegram_link_codes_owner_read on public.telegram_link_codes for select to authenticated using (user_id = auth.uid());
create policy telegram_link_codes_owner_write on public.telegram_link_codes for all to authenticated using (
  user_id = auth.uid() and public.has_business_role(business_id, array['owner','admin'])
) with check (user_id = auth.uid() and public.has_business_role(business_id, array['owner','admin']));
grant select, insert, update on public.telegram_link_codes to authenticated;

create or replace function public.consume_telegram_link_code(
  p_code_hash text, p_telegram_user_id bigint, p_telegram_chat_id bigint, p_username text, p_is_private_chat boolean
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_code public.telegram_link_codes; v_account_id uuid;
begin
  if not p_is_private_chat then raise exception 'Telegram account links must be completed in a private chat' using errcode = '22023'; end if;
  select * into v_code from public.telegram_link_codes
    where code_hash = p_code_hash and consumed_at is null and revoked_at is null and expires_at > public.current_timestamp_utc()
    for update;
  if not found then raise exception 'The link code is invalid, expired, or already used' using errcode = '22023'; end if;
  if not exists (select 1 from public.business_members where business_id = v_code.business_id and user_id = v_code.user_id and status = 'active' and role in ('owner','admin','accountant','staff')) then
    raise exception 'The account no longer has access to this business' using errcode = '42501';
  end if;
  insert into public.telegram_accounts (user_id, business_id, telegram_user_id, telegram_chat_id, username, linked_at, unlinked_at)
    values (v_code.user_id, v_code.business_id, p_telegram_user_id, p_telegram_chat_id, nullif(p_username, ''), public.current_timestamp_utc(), null)
  on conflict (telegram_user_id, telegram_chat_id) do update set user_id = excluded.user_id, business_id = excluded.business_id, username = excluded.username, linked_at = excluded.linked_at, unlinked_at = null
  returning id into v_account_id;
  update public.telegram_link_codes set consumed_at = public.current_timestamp_utc() where id = v_code.id;
  insert into public.telegram_user_preferences (telegram_account_id) values (v_account_id) on conflict do nothing;
  return v_account_id;
end;
$$;
revoke all on function public.consume_telegram_link_code(text, bigint, bigint, text, boolean) from public;
-- The long-polling worker uses service_role; normal browser users cannot consume codes.

create or replace function public.confirm_telegram_transaction(
  p_account_id uuid, p_draft_id uuid, p_idempotency_key text, p_transaction jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_account public.telegram_accounts; v_existing public.idempotency_keys; v_transaction public.transactions; v_draft jsonb;
begin
  select * into v_account from public.telegram_accounts where id = p_account_id and linked_at is not null and unlinked_at is null for update;
  if not found or not exists (select 1 from public.business_members where business_id = v_account.business_id and user_id = v_account.user_id and status = 'active' and role in ('owner','admin','accountant','staff')) then raise exception 'Telegram link is no longer authorized' using errcode = '42501'; end if;
  select * into v_existing from public.idempotency_keys where business_id = v_account.business_id and key = p_idempotency_key and operation = 'telegram.confirm' for update;
  if found and v_existing.response_body is not null then return v_existing.response_body; end if;
  insert into public.idempotency_keys (business_id, key, operation, expires_at) values (v_account.business_id, p_idempotency_key, 'telegram.confirm', public.current_timestamp_utc() + interval '7 days') on conflict do nothing;
  select draft into v_draft from public.telegram_conversation_states where telegram_account_id = p_account_id and draft_id = p_draft_id for update;
  if v_draft is null then raise exception 'The draft is stale or missing' using errcode = 'P0002'; end if;
  insert into public.transactions (id, business_id, direction, transaction_type, lifecycle, transaction_date, accounting_date, description, category_code, currency, subtotal_minor, total_minor, payment_status, payment_method_code, e_invoice_treatment, source_provenance, external_key, confirmed_at, confirmed_by, confirmation, source_links, lines, totals, created_by, updated_by)
    values ((p_transaction->>'id')::uuid, v_account.business_id, p_transaction->>'direction', p_transaction->>'transactionType', 'confirmed', (p_transaction->>'transactionDate')::date, (p_transaction->>'transactionDate')::date, p_transaction->>'description', p_transaction->>'category', 'MYR', (p_transaction->>'amountMinor')::bigint, (p_transaction->>'amountMinor')::bigint, 'not_applicable', nullif(p_transaction->>'paymentMethod', 'unknown'), 'undetermined', p_transaction->>'sourceType', 'telegram:' || p_account_id || ':' || p_draft_id, public.current_timestamp_utc(), v_account.user_id, p_transaction, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, v_account.user_id, v_account.user_id)
  returning * into v_transaction;
  insert into public.audit_events (business_id, actor_user_id, action, entity_type, entity_id, after_summary, source, request_id, metadata) values (v_account.business_id, v_account.user_id, 'telegram_transaction_confirmed', 'transaction', v_transaction.id, jsonb_build_object('lifecycle', 'confirmed'), 'telegram', p_idempotency_key, jsonb_build_object('telegram_account_id', p_account_id));
  update public.telegram_conversation_states set draft = jsonb_set(v_draft, '{status}', '"confirmed"'::jsonb), version = version + 1 where telegram_account_id = p_account_id and draft_id = p_draft_id;
  update public.idempotency_keys set response_status = 201, response_body = p_transaction where business_id = v_account.business_id and key = p_idempotency_key and operation = 'telegram.confirm';
  return p_transaction;
end;
$$;
revoke all on function public.confirm_telegram_transaction(uuid, uuid, text, jsonb) from public;

create or replace function public.void_telegram_transaction(p_account_id uuid, p_transaction_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_account public.telegram_accounts; v_transaction public.transactions;
begin
  select * into v_account from public.telegram_accounts where id = p_account_id and linked_at is not null and unlinked_at is null;
  if not found or not exists (select 1 from public.business_members where business_id = v_account.business_id and user_id = v_account.user_id and status = 'active' and role in ('owner','admin','accountant','staff')) then raise exception 'Telegram link is no longer authorized' using errcode = '42501'; end if;
  select * into v_transaction from public.transactions where id = p_transaction_id and business_id = v_account.business_id and lifecycle = 'confirmed' and confirmed_at >= public.current_timestamp_utc() - interval '5 minutes' for update;
  if not found then raise exception 'The transaction can no longer be undone' using errcode = '22023'; end if;
  update public.transactions set lifecycle = 'voided', voided_at = public.current_timestamp_utc(), voided_by = v_account.user_id, void_reason = left(nullif(btrim(p_reason), ''), 280), void_metadata = jsonb_build_object('source', 'telegram_undo') where id = v_transaction.id;
  insert into public.audit_events (business_id, actor_user_id, action, entity_type, entity_id, before_summary, after_summary, source, metadata) values (v_account.business_id, v_account.user_id, 'telegram_transaction_voided', 'transaction', v_transaction.id, jsonb_build_object('lifecycle', 'confirmed'), jsonb_build_object('lifecycle', 'voided'), 'telegram', jsonb_build_object('telegram_account_id', p_account_id));
end;
$$;
revoke all on function public.void_telegram_transaction(uuid, uuid, text) from public;
