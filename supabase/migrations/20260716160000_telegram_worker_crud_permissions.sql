-- The Telegram worker authenticates with service_role. Session 7 deliberately
-- revoked PUBLIC execution but omitted the corresponding worker grants, which
-- made linking, confirmation, and undo fail at the RPC boundary.
grant execute on function public.consume_telegram_link_code(text, bigint, bigint, text, boolean) to service_role;
grant execute on function public.confirm_telegram_transaction(uuid, uuid, text, jsonb) to service_role;
grant execute on function public.void_telegram_transaction(uuid, uuid, text) to service_role;

-- Keep direct worker CRUD explicit as well. Authorization is still enforced by
-- the account resolver and again inside the security-definer RPCs.
grant select, insert, update, delete on public.telegram_accounts to service_role;
grant select, insert, update, delete on public.telegram_conversation_states to service_role;
grant select, insert, update, delete on public.telegram_user_preferences to service_role;
grant select on public.business_members to service_role;
grant select on public.transactions to service_role;

-- Web writes have auth.uid(); trusted-worker RPCs do not. Preserve the same
-- lifecycle invariants while deriving the worker actor from the values set by
-- the RPC. Browser callers cannot spoof this because auth.uid() wins.
create or replace function public.apply_transaction_lifecycle_audit_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
begin
  if tg_op = 'INSERT' then
    v_actor := coalesce(auth.uid(), new.created_by, new.updated_by, new.confirmed_by, new.voided_by);
  else
    v_actor := coalesce(auth.uid(), new.updated_by, new.voided_by, new.confirmed_by, old.updated_by, old.created_by);
  end if;
  if v_actor is null then raise exception 'an authenticated actor is required' using errcode = '42501'; end if;

  if tg_op = 'INSERT' then
    new.created_by := v_actor;
    new.updated_by := v_actor;
  else
    new.updated_by := v_actor;
    new.version := old.version + 1;
  end if;
  if new.lifecycle = 'confirmed' and (tg_op = 'INSERT' or old.lifecycle is distinct from 'confirmed') then
    new.confirmed_at := coalesce(new.confirmed_at, now());
    new.confirmed_by := v_actor;
  end if;
  if new.lifecycle = 'voided' and (tg_op = 'INSERT' or old.lifecycle is distinct from 'voided') then
    new.voided_at := coalesce(new.voided_at, now());
    new.voided_by := v_actor;
    new.void_reason := nullif(btrim(new.void_reason), '');
    if new.void_reason is null then raise exception 'a void reason is required' using errcode = '22023'; end if;
  end if;
  return new;
end;
$$;

create or replace function public.record_transaction_lifecycle_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_lifecycle text := case when tg_op = 'INSERT' then null else old.lifecycle end;
  v_actor uuid := coalesce(auth.uid(), new.updated_by, new.created_by, new.voided_by, new.confirmed_by);
begin
  if tg_op = 'INSERT' or old.lifecycle is distinct from new.lifecycle then
    insert into public.transaction_status_history (transaction_id, from_status, to_status, reason, changed_by)
    values (new.id, previous_lifecycle, new.lifecycle, case when new.lifecycle = 'voided' then new.void_reason else null end, v_actor);
  end if;
  insert into public.audit_events (business_id, actor_user_id, action, entity_type, entity_id, before_summary, after_summary, source)
  values (new.business_id, v_actor,
    case when tg_op = 'INSERT' then 'transaction.created' when old.lifecycle is distinct from new.lifecycle then 'transaction.lifecycle_changed' else 'transaction.updated' end,
    'transaction', new.id,
    case when tg_op = 'INSERT' then null else jsonb_build_object('lifecycle', old.lifecycle, 'version', old.version) end,
    jsonb_build_object('lifecycle', new.lifecycle, 'version', new.version),
    case when auth.uid() is null then 'telegram' else 'web' end);
  return new;
end;
$$;

revoke all on function public.apply_transaction_lifecycle_audit_fields(), public.record_transaction_lifecycle_audit() from public;

-- save_invoice_draft stores subtotal_minor after line discounts and charges
-- have already been applied. The original table check subtracted discounts a
-- second time, causing valid discounted drafts to fail on insert/update.
do $$
declare v_constraint text;
begin
  select conname into v_constraint
  from pg_constraint
  where conrelid = 'public.invoices'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%total_minor = ((subtotal_minor - discount_minor)%';
  if v_constraint is not null then
    execute format('alter table public.invoices drop constraint %I', v_constraint);
  end if;
end;
$$;
alter table public.invoices drop constraint if exists invoices_check1;
alter table public.invoices
  add constraint invoices_totals_reconcile_check
  check (total_minor = subtotal_minor + tax_minor + rounding_minor);

-- A polymorphic trigger record cannot safely reference columns that do not
-- exist on every attached table. Read optional fields through JSON so invoice,
-- payment, reminder, tag, evidence, and transaction-line writes all work.
create or replace function public.assert_same_business_reference()
returns trigger language plpgsql security definer set search_path = public as $$
declare parent_business uuid; referenced_business uuid; v_new jsonb := to_jsonb(new);
begin
  if tg_table_name = 'transaction_line_items' and nullif(v_new->>'product_service_id','') is not null then
    select t.business_id, p.business_id into parent_business, referenced_business from public.transactions t, public.products_services p where t.id = (v_new->>'transaction_id')::uuid and p.id = (v_new->>'product_service_id')::uuid;
  elsif tg_table_name = 'invoices' and nullif(v_new->>'customer_id','') is not null then
    parent_business := (v_new->>'business_id')::uuid;
    select p.business_id into referenced_business from public.parties p where p.id = (v_new->>'customer_id')::uuid;
  elsif tg_table_name = 'invoice_payments' and nullif(v_new->>'transaction_id','') is not null then
    select i.business_id, t.business_id into parent_business, referenced_business from public.invoices i, public.transactions t where i.id = (v_new->>'invoice_id')::uuid and t.id = (v_new->>'transaction_id')::uuid;
  elsif tg_table_name = 'transaction_tags' then
    select t.business_id, g.business_id into parent_business, referenced_business from public.transactions t, public.tags g where t.id = (v_new->>'transaction_id')::uuid and g.id = (v_new->>'tag_id')::uuid;
  elsif tg_table_name = 'transaction_evidence_links' then
    select t.business_id, e.business_id into parent_business, referenced_business from public.transactions t, public.evidence_files e where t.id = (v_new->>'transaction_id')::uuid and e.id = (v_new->>'evidence_file_id')::uuid;
  elsif tg_table_name = 'payment_reminders' and nullif(v_new->>'invoice_id','') is not null then
    parent_business := (v_new->>'business_id')::uuid;
    select i.business_id into referenced_business from public.invoices i where i.id = (v_new->>'invoice_id')::uuid;
  end if;
  if parent_business is not null and referenced_business is distinct from parent_business then raise exception 'cross-business reference is not allowed' using errcode = '23514'; end if;
  return new;
end;
$$;
revoke all on function public.assert_same_business_reference() from public;
