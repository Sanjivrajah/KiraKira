-- Session 5: keep web-originated transaction lifecycle changes auditable even
-- when the browser uses the typed repository directly through PostgREST.

create or replace function public.apply_transaction_lifecycle_audit_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
    new.updated_by := coalesce(new.updated_by, auth.uid());
  else
    new.updated_by := auth.uid();
    new.version := old.version + 1;
  end if;

  if new.lifecycle = 'confirmed' and (tg_op = 'INSERT' or old.lifecycle is distinct from 'confirmed') then
    new.confirmed_at := coalesce(new.confirmed_at, now());
    new.confirmed_by := coalesce(new.confirmed_by, auth.uid());
  end if;

  if new.lifecycle = 'voided' and (tg_op = 'INSERT' or old.lifecycle is distinct from 'voided') then
    new.voided_at := coalesce(new.voided_at, now());
    new.voided_by := coalesce(new.voided_by, auth.uid());
    new.void_reason := nullif(btrim(new.void_reason), '');
    if new.void_reason is null then
      raise exception 'a void reason is required' using errcode = '22023';
    end if;
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
begin
  if tg_op = 'INSERT' or old.lifecycle is distinct from new.lifecycle then
    insert into public.transaction_status_history (transaction_id, from_status, to_status, reason, changed_by)
    values (new.id, previous_lifecycle, new.lifecycle, case when new.lifecycle = 'voided' then new.void_reason else null end, auth.uid());
  end if;

  insert into public.audit_events (business_id, actor_user_id, action, entity_type, entity_id, before_summary, after_summary, source)
  values (
    new.business_id,
    auth.uid(),
    case when tg_op = 'INSERT' then 'transaction.created' when old.lifecycle is distinct from new.lifecycle then 'transaction.lifecycle_changed' else 'transaction.updated' end,
    'transaction',
    new.id,
    case when tg_op = 'INSERT' then null else jsonb_build_object('lifecycle', old.lifecycle, 'version', old.version) end,
    jsonb_build_object('lifecycle', new.lifecycle, 'version', new.version),
    'web'
  );
  return new;
end;
$$;

drop trigger if exists transactions_apply_lifecycle_audit_fields on public.transactions;
create trigger transactions_apply_lifecycle_audit_fields
before insert or update on public.transactions
for each row execute function public.apply_transaction_lifecycle_audit_fields();

drop trigger if exists transactions_record_lifecycle_audit on public.transactions;
create trigger transactions_record_lifecycle_audit
after insert or update on public.transactions
for each row execute function public.record_transaction_lifecycle_audit();

revoke all on function public.apply_transaction_lifecycle_audit_fields(), public.record_transaction_lifecycle_audit() from public;
