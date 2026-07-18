-- Session 6: all invoice state mutations are routed through the functions below.
-- Drafts use a non-customer-facing DRAFT- UUID. A sequence number is allocated only
-- when issued, making the draft-number policy explicit and avoiding wasted numbers.

create table public.invoice_sequences (
  business_id uuid not null references public.businesses(id) on delete cascade,
  prefix text not null default 'INV-',
  fiscal_period text not null default '',
  next_value bigint not null default 1 check (next_value > 0),
  primary key (business_id, prefix, fiscal_period)
);

create table public.invoice_payment_reversals (
  id uuid primary key default gen_random_uuid(),
  invoice_payment_id uuid not null references public.invoice_payments(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  reason text not null check (length(btrim(reason)) > 0),
  reversed_at timestamptz not null default public.current_timestamp_utc(),
  reversed_by uuid references public.profiles(id) on delete set null
);

alter table public.invoices add constraint invoices_issued_number_check
  check (invoice_number !~ '^DRAFT-' or status in ('draft','void','cancelled'));

create or replace function public.invoice_audit_event(p_invoice public.invoices, p_action text, p_before jsonb default null, p_metadata jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_events (business_id, actor_user_id, action, entity_type, entity_id, before_summary, after_summary, source, metadata)
  values (p_invoice.business_id, auth.uid(), p_action, 'invoice', p_invoice.id, p_before,
    jsonb_build_object('status', p_invoice.status, 'invoice_number', p_invoice.invoice_number, 'total_minor', p_invoice.total_minor, 'amount_paid_minor', p_invoice.amount_paid_minor),
    'invoice_service', coalesce(p_metadata, '{}'::jsonb));
end;
$$;

create or replace function public.invoice_assert_transition()
returns trigger language plpgsql set search_path = public as $$
declare allowed boolean := false;
begin
  if tg_op = 'UPDATE' and old.status <> 'draft' then
    if new.invoice_number <> old.invoice_number or new.customer_id is distinct from old.customer_id
      or new.customer_snapshot <> old.customer_snapshot or new.supplier_snapshot <> old.supplier_snapshot
      or new.issue_date <> old.issue_date or new.due_date is distinct from old.due_date
      or new.currency <> old.currency or new.subtotal_minor <> old.subtotal_minor
      or new.discount_minor <> old.discount_minor or new.tax_minor <> old.tax_minor
      or new.rounding_minor <> old.rounding_minor or new.total_minor <> old.total_minor
      or new.notes is distinct from old.notes or new.payment_terms is distinct from old.payment_terms then
      raise exception 'issued invoice financial and buyer snapshots are immutable' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'UPDATE' and new.status <> old.status then
    allowed := (old.status = 'draft' and new.status in ('sent','void','cancelled'))
      or (old.status in ('sent','overdue') and new.status in ('partially_paid','paid','void','cancelled'))
      or (old.status = 'partially_paid' and new.status in ('paid','overdue','void','cancelled'))
      or (old.status = 'sent' and new.status = 'overdue');
    if not allowed then raise exception 'invalid invoice status transition: % -> %', old.status, new.status using errcode = '23514'; end if;
    insert into public.invoice_status_history(invoice_id, from_status, to_status, reason, changed_by)
    values (new.id, old.status, new.status, new.void_reason, auth.uid());
  end if;
  return new;
end;
$$;
create trigger invoices_enforce_lifecycle before update on public.invoices for each row execute function public.invoice_assert_transition();

create or replace function public.save_invoice_draft(p_business_id uuid, p_invoice_id uuid default null, p_invoice jsonb default '{}'::jsonb, p_items jsonb default '[]'::jsonb)
returns public.invoices language plpgsql security definer set search_path = public as $$
declare v_invoice public.invoices; v_item jsonb; v_subtotal bigint := 0; v_tax bigint := 0; v_discount bigint := 0; v_rounding bigint := coalesce((p_invoice->>'rounding_minor')::bigint, 0);
  v_line_subtotal bigint; v_line_tax bigint; v_line_discount bigint; v_line_charge bigint; v_line_total bigint; v_line_number integer := 0; v_existing boolean := false;
begin
  if not public.has_business_role(p_business_id, array['owner','admin','accountant']) then raise exception 'invoice write permission is required' using errcode='42501'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'an invoice needs at least one line item' using errcode='23514'; end if;
  select * into v_invoice from public.invoices where id=p_invoice_id and business_id=p_business_id for update;
  v_existing := found;
  if v_existing and v_invoice.status <> 'draft' then raise exception 'only drafts can be edited' using errcode='23514'; end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_line_number := v_line_number + 1;
    if coalesce((v_item->>'quantity')::numeric, 0) <= 0 or coalesce((v_item->>'unit_price_minor')::bigint, -1) < 0 then raise exception 'invalid invoice line' using errcode='23514'; end if;
    v_line_discount := coalesce((v_item->>'discount_minor')::bigint,0); v_line_charge := coalesce((v_item->>'charge_minor')::bigint,0);
    v_line_subtotal := round((v_item->>'quantity')::numeric * (v_item->>'unit_price_minor')::numeric)::bigint - v_line_discount + v_line_charge;
    v_line_tax := round(v_line_subtotal * coalesce((v_item->>'tax_rate')::numeric,0) / 100)::bigint; v_line_total := v_line_subtotal + v_line_tax;
    if v_line_subtotal < 0 then raise exception 'line discount cannot exceed its amount' using errcode='23514'; end if;
    v_subtotal := v_subtotal + v_line_subtotal; v_tax := v_tax + v_line_tax; v_discount := v_discount + v_line_discount;
  end loop;
  if v_existing then
    update public.invoices set customer_id=nullif(p_invoice->>'customer_id','')::uuid, customer_snapshot=coalesce(p_invoice->'customer_snapshot','{}'::jsonb), supplier_snapshot=coalesce(p_invoice->'supplier_snapshot','{}'::jsonb), issue_date=(p_invoice->>'issue_date')::date, due_date=nullif(p_invoice->>'due_date','')::date, currency=upper(p_invoice->>'currency'), subtotal_minor=v_subtotal, discount_minor=v_discount, tax_minor=v_tax, rounding_minor=v_rounding, total_minor=v_subtotal+v_tax+v_rounding, notes=nullif(p_invoice->>'notes',''), payment_terms=nullif(p_invoice->>'payment_terms',''), updated_by=auth.uid(), version=version+1 where id=p_invoice_id returning * into v_invoice;
    delete from public.invoice_items where invoice_id=p_invoice_id;
  else
    insert into public.invoices(id,business_id,invoice_number,customer_id,customer_snapshot,supplier_snapshot,issue_date,due_date,currency,status,subtotal_minor,discount_minor,tax_minor,rounding_minor,total_minor,notes,payment_terms,created_by,updated_by)
    values(coalesce(p_invoice_id,gen_random_uuid()),p_business_id,'DRAFT-' || coalesce(p_invoice_id,gen_random_uuid())::text,nullif(p_invoice->>'customer_id','')::uuid,coalesce(p_invoice->'customer_snapshot','{}'::jsonb),coalesce(p_invoice->'supplier_snapshot','{}'::jsonb),(p_invoice->>'issue_date')::date,nullif(p_invoice->>'due_date','')::date,upper(p_invoice->>'currency'),'draft',v_subtotal,v_discount,v_tax,v_rounding,v_subtotal+v_tax+v_rounding,nullif(p_invoice->>'notes',''),nullif(p_invoice->>'payment_terms',''),auth.uid(),auth.uid()) returning * into v_invoice;
  end if;
  v_line_number := 0;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_line_number := v_line_number + 1; v_line_discount := coalesce((v_item->>'discount_minor')::bigint,0); v_line_charge := coalesce((v_item->>'charge_minor')::bigint,0);
    v_line_subtotal := round((v_item->>'quantity')::numeric * (v_item->>'unit_price_minor')::numeric)::bigint - v_line_discount + v_line_charge; v_line_tax := round(v_line_subtotal * coalesce((v_item->>'tax_rate')::numeric,0) / 100)::bigint;
    insert into public.invoice_items(invoice_id,line_number,description,quantity,unit_code,unit_price_minor,discount_minor,charge_minor,tax_type_code,tax_rate,tax_minor,subtotal_minor,total_minor,classification_code,exemption_reason)
    values(v_invoice.id,v_line_number,v_item->>'description',(v_item->>'quantity')::numeric,nullif(v_item->>'unit_code',''),(v_item->>'unit_price_minor')::bigint,v_line_discount,v_line_charge,coalesce(nullif(v_item->>'tax_type_code',''),'01'),coalesce((v_item->>'tax_rate')::numeric,0),v_line_tax,v_line_subtotal,v_line_subtotal+v_line_tax,nullif(v_item->>'classification_code',''),nullif(v_item->>'exemption_reason',''));
  end loop;
  perform public.invoice_audit_event(v_invoice, case when p_invoice_id is null then 'invoice.draft_created' else 'invoice.draft_updated' end); return v_invoice;
end;
$$;

create or replace function public.issue_invoice(p_invoice_id uuid, p_prefix text default 'INV-', p_fiscal_period text default '')
returns public.invoices language plpgsql security definer set search_path = public as $$
declare v_invoice public.invoices; v_number bigint;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found or not public.can_write_invoice(p_invoice_id) then raise exception 'invoice write permission is required' using errcode = '42501'; end if;
  if v_invoice.status <> 'draft' then raise exception 'only drafts can be issued' using errcode = '23514'; end if;
  insert into public.invoice_sequences(business_id,prefix,fiscal_period) values(v_invoice.business_id,p_prefix,p_fiscal_period)
    on conflict (business_id,prefix,fiscal_period) do nothing;
  update public.invoice_sequences set next_value = next_value + 1
    where business_id=v_invoice.business_id and prefix=p_prefix and fiscal_period=p_fiscal_period returning next_value - 1 into v_number;
  update public.invoices set invoice_number = p_prefix || coalesce(nullif(p_fiscal_period,'' ) || '-','') || lpad(v_number::text, 6, '0'),
    status='sent', issued_at=public.current_timestamp_utc(), updated_by=auth.uid(), version=version+1 where id=p_invoice_id returning * into v_invoice;
  perform public.invoice_audit_event(v_invoice, 'invoice.issued'); return v_invoice;
end;
$$;

create or replace function public.mark_overdue_invoices(p_business_id uuid default null)
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  if p_business_id is not null and not public.has_business_role(p_business_id,array['owner','admin','accountant']) then raise exception 'invoice read permission is required' using errcode='42501'; end if;
  with changed as (update public.invoices set status='overdue', updated_by=auth.uid(), version=version+1 where status in ('sent','partially_paid') and due_date < current_date and (p_business_id is null or business_id=p_business_id) returning *)
  select count(*) into v_count from changed; return v_count;
end;
$$;

create or replace function public.record_invoice_payment(p_invoice_id uuid, p_amount_minor bigint, p_currency char(3), p_paid_at timestamptz, p_method text default null, p_reference text default null, p_transaction_id uuid default null)
returns public.invoice_payments language plpgsql security definer set search_path = public as $$
declare v_invoice public.invoices; v_payment public.invoice_payments; v_status text;
begin
  select * into v_invoice from public.invoices where id=p_invoice_id for update;
  if not found or not public.can_write_invoice(p_invoice_id) then raise exception 'invoice write permission is required' using errcode='42501'; end if;
  if v_invoice.status not in ('sent','overdue','partially_paid') then raise exception 'payments require an issued unpaid invoice' using errcode='23514'; end if;
  if p_amount_minor <= 0 or p_currency <> v_invoice.currency or p_amount_minor > v_invoice.total_minor - v_invoice.amount_paid_minor then
    raise exception 'payment exceeds outstanding balance or has a different currency' using errcode='23514'; end if;
  insert into public.invoice_payments(invoice_id,transaction_id,amount_minor,currency,paid_at,payment_method_code,external_reference)
  values(p_invoice_id,p_transaction_id,p_amount_minor,p_currency,p_paid_at,p_method,p_reference) returning * into v_payment;
  v_status := case when v_invoice.amount_paid_minor+p_amount_minor = v_invoice.total_minor then 'paid' else 'partially_paid' end;
  update public.invoices set amount_paid_minor=amount_paid_minor+p_amount_minor,status=v_status,updated_by=auth.uid(),version=version+1 where id=p_invoice_id returning * into v_invoice;
  perform public.invoice_audit_event(v_invoice, 'invoice.payment_recorded', null, jsonb_build_object('payment_id',v_payment.id,'amount_minor',p_amount_minor)); return v_payment;
end;
$$;

create or replace function public.reverse_invoice_payment(p_payment_id uuid, p_reason text)
returns public.invoices language plpgsql security definer set search_path = public as $$
declare v_payment public.invoice_payments; v_invoice public.invoices;
begin
  select p.* into v_payment from public.invoice_payments p where p.id=p_payment_id for update;
  select * into v_invoice from public.invoices where id=v_payment.invoice_id for update;
  if not found or not public.can_write_invoice(v_payment.invoice_id) then raise exception 'invoice write permission is required' using errcode='42501'; end if;
  insert into public.invoice_payment_reversals(invoice_payment_id,amount_minor,reason,reversed_by) values(p_payment_id,v_payment.amount_minor,p_reason,auth.uid());
  update public.invoices set amount_paid_minor=amount_paid_minor-v_payment.amount_minor,status=case when amount_paid_minor-v_payment.amount_minor=0 then 'sent' else 'partially_paid' end,updated_by=auth.uid(),version=version+1 where id=v_invoice.id returning * into v_invoice;
  perform public.invoice_audit_event(v_invoice, 'invoice.payment_reversed', null, jsonb_build_object('payment_id',p_payment_id,'reason',p_reason)); return v_invoice;
end;
$$;

create or replace function public.void_invoice(p_invoice_id uuid, p_reason text, p_cancelled boolean default false)
returns public.invoices language plpgsql security definer set search_path = public as $$
declare v_invoice public.invoices;
begin
  select * into v_invoice from public.invoices where id=p_invoice_id for update;
  if not found or not public.can_write_invoice(p_invoice_id) then raise exception 'invoice write permission is required' using errcode='42501'; end if;
  if v_invoice.status in ('paid','void','cancelled') or exists(select 1 from public.invoice_payments where invoice_id=p_invoice_id) then raise exception 'paid or allocated invoices cannot be voided' using errcode='23514'; end if;
  if nullif(btrim(p_reason),'') is null then raise exception 'a void reason is required' using errcode='23514'; end if;
  update public.invoices set status=case when p_cancelled then 'cancelled' else 'void' end,void_reason=p_reason,voided_at=public.current_timestamp_utc(),voided_by=auth.uid(),updated_by=auth.uid(),version=version+1 where id=p_invoice_id returning * into v_invoice;
  perform public.invoice_audit_event(v_invoice, 'invoice.voided', null, jsonb_build_object('reason',p_reason)); return v_invoice;
end;
$$;

create or replace function public.claim_reminder_delivery(p_reminder_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_reminder public.payment_reminders;
begin
  select * into v_reminder from public.payment_reminders where id=p_reminder_id for update;
  if not found or not public.can_write_reminder(p_reminder_id) then raise exception 'reminder write permission is required' using errcode='42501'; end if;
  if v_reminder.status <> 'scheduled' then return false; end if;
  update public.payment_reminders set status='processing' where id=p_reminder_id;
  insert into public.reminder_deliveries(reminder_id,attempt_number,status) values(p_reminder_id,(select count(*)+1 from public.reminder_deliveries where reminder_id=p_reminder_id),'pending');
  return true;
end;
$$;

create or replace function public.complete_reminder_delivery(p_reminder_id uuid, p_sent boolean, p_provider_response jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_reminder public.payment_reminders;
begin
  select * into v_reminder from public.payment_reminders where id=p_reminder_id for update;
  if not found or not public.can_write_reminder(p_reminder_id) then raise exception 'reminder write permission is required' using errcode='42501'; end if;
  if v_reminder.status <> 'processing' then raise exception 'reminder has not been claimed' using errcode='23514'; end if;
  update public.reminder_deliveries set status=case when p_sent then 'sent' else 'failed' end, provider_response=p_provider_response where reminder_id=p_reminder_id and attempt_number=(select max(attempt_number) from public.reminder_deliveries where reminder_id=p_reminder_id);
  update public.payment_reminders set status=case when p_sent then 'sent' else 'failed' end where id=p_reminder_id;
  insert into public.audit_events(business_id,actor_user_id,action,entity_type,entity_id,source,metadata) values(v_reminder.business_id,auth.uid(),case when p_sent then 'reminder.sent' else 'reminder.failed' end,'reminder',v_reminder.id,'reminder_service',jsonb_build_object('invoice_id',v_reminder.invoice_id));
end;
$$;

alter table public.invoice_sequences enable row level security;
alter table public.invoice_payment_reversals enable row level security;
create policy invoice_sequences_read on public.invoice_sequences for select to authenticated using (public.has_business_role(business_id,array['owner','admin','accountant']));
create policy payment_reversals_read on public.invoice_payment_reversals for select to authenticated using (public.is_invoice_member((select invoice_id from public.invoice_payments where id=invoice_payment_id)));
revoke all on public.invoice_sequences, public.invoice_payment_reversals from authenticated;
grant select on public.invoice_sequences, public.invoice_payment_reversals to authenticated;
revoke all on function public.invoice_audit_event(public.invoices,text,jsonb,jsonb), public.invoice_assert_transition(), public.save_invoice_draft(uuid,uuid,jsonb,jsonb), public.issue_invoice(uuid,text,text), public.mark_overdue_invoices(uuid), public.record_invoice_payment(uuid,bigint,char,timestamptz,text,text,uuid), public.reverse_invoice_payment(uuid,text), public.void_invoice(uuid,text,boolean), public.claim_reminder_delivery(uuid), public.complete_reminder_delivery(uuid,boolean,jsonb) from public;
grant execute on function public.save_invoice_draft(uuid,uuid,jsonb,jsonb), public.issue_invoice(uuid,text,text), public.mark_overdue_invoices(uuid), public.record_invoice_payment(uuid,bigint,char,timestamptz,text,text,uuid), public.reverse_invoice_payment(uuid,text), public.void_invoice(uuid,text,boolean), public.claim_reminder_delivery(uuid), public.complete_reminder_delivery(uuid,boolean,jsonb) to authenticated;
