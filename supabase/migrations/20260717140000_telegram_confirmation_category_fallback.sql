-- Telegram extraction may deliberately leave category blank. The canonical
-- transaction table requires category_code, so preserve confirmation while
-- recording an explicit, honest fallback rather than inventing a category.
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
    values ((p_transaction->>'id')::uuid, v_account.business_id, p_transaction->>'direction', p_transaction->>'transactionType', 'confirmed', (p_transaction->>'transactionDate')::date, (p_transaction->>'transactionDate')::date, p_transaction->>'description', coalesce(nullif(btrim(p_transaction->>'category'), ''), 'uncategorized'), 'MYR', (p_transaction->>'amountMinor')::bigint, (p_transaction->>'amountMinor')::bigint, 'not_applicable', nullif(p_transaction->>'paymentMethod', 'unknown'), 'undetermined', p_transaction->>'sourceType', 'telegram:' || p_account_id || ':' || p_draft_id, public.current_timestamp_utc(), v_account.user_id, p_transaction, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, v_account.user_id, v_account.user_id)
  returning * into v_transaction;
  insert into public.audit_events (business_id, actor_user_id, action, entity_type, entity_id, after_summary, source, request_id, metadata) values (v_account.business_id, v_account.user_id, 'telegram_transaction_confirmed', 'transaction', v_transaction.id, jsonb_build_object('lifecycle', 'confirmed'), 'telegram', p_idempotency_key, jsonb_build_object('telegram_account_id', p_account_id));
  update public.telegram_conversation_states set draft = jsonb_set(v_draft, '{status}', '"confirmed"'::jsonb), version = version + 1 where telegram_account_id = p_account_id and draft_id = p_draft_id;
  update public.idempotency_keys set response_status = 201, response_body = p_transaction where business_id = v_account.business_id and key = p_idempotency_key and operation = 'telegram.confirm';
  return p_transaction;
end;
$$;
revoke all on function public.confirm_telegram_transaction(uuid, uuid, text, jsonb) from public;
grant execute on function public.confirm_telegram_transaction(uuid, uuid, text, jsonb) to service_role;
