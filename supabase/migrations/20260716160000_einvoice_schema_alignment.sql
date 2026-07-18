-- Up Migration: Add E-Invoice Fields and Align Domain Models

-- 1. Invoices Table Extensions
alter table public.invoices add column shipping_recipient_party_id uuid references public.parties(id) on delete set null;
alter table public.invoices add column billing_period_start date;
alter table public.invoices add column billing_period_end date;
alter table public.invoices add column charge_minor bigint not null default 0 check (charge_minor >= 0);
alter table public.invoices add column document_references jsonb not null default '[]'::jsonb;

-- 2. Invoices Constraints Update
-- Drop the existing unnamed constraint that checks total_minor
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN (
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.invoices'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%total_minor = %'
    ) LOOP
        EXECUTE 'ALTER TABLE public.invoices DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END
$$;

-- Add the new named constraint including charge_minor
alter table public.invoices add constraint invoices_totals_check 
  check (total_minor = subtotal_minor - discount_minor + charge_minor + tax_minor + rounding_minor);

-- 3. Invoice Items Table Extensions
alter table public.invoice_items add column country_of_origin char(2);
alter table public.invoice_items add column tariff_code text;

-- 4. Update invoice_assert_transition
create or replace function public.invoice_assert_transition()
returns trigger language plpgsql set search_path = public as $$
declare allowed boolean := false;
begin
  if tg_op = 'UPDATE' and old.status <> 'draft' then
    if new.invoice_number <> old.invoice_number or new.customer_id is distinct from old.customer_id
      or new.customer_snapshot <> old.customer_snapshot or new.supplier_snapshot <> old.supplier_snapshot
      or new.issue_date <> old.issue_date or new.due_date is distinct from old.due_date
      or new.currency <> old.currency or new.subtotal_minor <> old.subtotal_minor
      or new.discount_minor <> old.discount_minor or new.charge_minor <> old.charge_minor or new.tax_minor <> old.tax_minor
      or new.rounding_minor <> old.rounding_minor or new.total_minor <> old.total_minor
      or new.notes is distinct from old.notes or new.payment_terms is distinct from old.payment_terms
      or new.shipping_recipient_party_id is distinct from old.shipping_recipient_party_id
      or new.billing_period_start is distinct from old.billing_period_start
      or new.billing_period_end is distinct from old.billing_period_end
      or new.document_references <> old.document_references then
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

-- 5. Update save_invoice_draft
create or replace function public.save_invoice_draft(p_business_id uuid, p_invoice_id uuid default null, p_invoice jsonb default '{}'::jsonb, p_items jsonb default '[]'::jsonb)
returns public.invoices language plpgsql security definer set search_path = public as $$
declare v_invoice public.invoices; v_item jsonb; v_subtotal bigint := 0; v_tax bigint := 0; v_discount bigint := 0; v_charge bigint := coalesce((p_invoice->>'charge_minor')::bigint, 0); v_rounding bigint := coalesce((p_invoice->>'rounding_minor')::bigint, 0);
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
    v_line_discount := coalesce((v_item->>'discount_minor')::bigint,0); 
    v_line_charge := coalesce((v_item->>'charge_minor')::bigint,0);
    
    -- Fix: subtotal is quantity * unit price. Discounts and charges apply to the line total, not the subtotal minor
    v_line_subtotal := round((v_item->>'quantity')::numeric * (v_item->>'unit_price_minor')::numeric)::bigint;
    v_line_tax := round((v_line_subtotal - v_line_discount + v_line_charge) * coalesce((v_item->>'tax_rate')::numeric,0) / 100)::bigint; 
    v_line_total := v_line_subtotal - v_line_discount + v_line_charge + v_line_tax;
    
    if v_line_subtotal < v_line_discount then raise exception 'line discount cannot exceed its amount' using errcode='23514'; end if;
    v_subtotal := v_subtotal + v_line_subtotal; 
    v_tax := v_tax + v_line_tax; 
    v_discount := v_discount + v_line_discount;
    v_charge := v_charge + v_line_charge;
  end loop;
  
  if v_existing then
    update public.invoices set customer_id=nullif(p_invoice->>'customer_id','')::uuid, customer_snapshot=coalesce(p_invoice->'customer_snapshot','{}'::jsonb), supplier_snapshot=coalesce(p_invoice->'supplier_snapshot','{}'::jsonb), issue_date=(p_invoice->>'issue_date')::date, due_date=nullif(p_invoice->>'due_date','')::date, currency=upper(p_invoice->>'currency'), subtotal_minor=v_subtotal, discount_minor=v_discount, charge_minor=v_charge, tax_minor=v_tax, rounding_minor=v_rounding, total_minor=v_subtotal-v_discount+v_charge+v_tax+v_rounding, notes=nullif(p_invoice->>'notes',''), payment_terms=nullif(p_invoice->>'payment_terms',''), shipping_recipient_party_id=nullif(p_invoice->>'shipping_recipient_party_id','')::uuid, billing_period_start=nullif(p_invoice->>'billing_period_start','')::date, billing_period_end=nullif(p_invoice->>'billing_period_end','')::date, document_references=coalesce(p_invoice->'document_references','[]'::jsonb), updated_by=auth.uid(), version=version+1 where id=p_invoice_id returning * into v_invoice;
    delete from public.invoice_items where invoice_id=p_invoice_id;
  else
    insert into public.invoices(id,business_id,invoice_number,customer_id,customer_snapshot,supplier_snapshot,issue_date,due_date,currency,status,subtotal_minor,discount_minor,charge_minor,tax_minor,rounding_minor,total_minor,notes,payment_terms,shipping_recipient_party_id,billing_period_start,billing_period_end,document_references,created_by,updated_by)
    values(coalesce(p_invoice_id,gen_random_uuid()),p_business_id,'DRAFT-' || coalesce(p_invoice_id,gen_random_uuid())::text,nullif(p_invoice->>'customer_id','')::uuid,coalesce(p_invoice->'customer_snapshot','{}'::jsonb),coalesce(p_invoice->'supplier_snapshot','{}'::jsonb),(p_invoice->>'issue_date')::date,nullif(p_invoice->>'due_date','')::date,upper(p_invoice->>'currency'),'draft',v_subtotal,v_discount,v_charge,v_tax,v_rounding,v_subtotal-v_discount+v_charge+v_tax+v_rounding,nullif(p_invoice->>'notes',''),nullif(p_invoice->>'payment_terms',''),nullif(p_invoice->>'shipping_recipient_party_id','')::uuid,nullif(p_invoice->>'billing_period_start','')::date,nullif(p_invoice->>'billing_period_end','')::date,coalesce(p_invoice->'document_references','[]'::jsonb),auth.uid(),auth.uid()) returning * into v_invoice;
  end if;
  
  v_line_number := 0;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_line_number := v_line_number + 1; v_line_discount := coalesce((v_item->>'discount_minor')::bigint,0); v_line_charge := coalesce((v_item->>'charge_minor')::bigint,0);
    v_line_subtotal := round((v_item->>'quantity')::numeric * (v_item->>'unit_price_minor')::numeric)::bigint; v_line_tax := round((v_line_subtotal - v_line_discount + v_line_charge) * coalesce((v_item->>'tax_rate')::numeric,0) / 100)::bigint;
    insert into public.invoice_items(invoice_id,line_number,description,quantity,unit_code,unit_price_minor,discount_minor,charge_minor,tax_type_code,tax_rate,tax_minor,subtotal_minor,total_minor,classification_code,exemption_reason,country_of_origin,tariff_code)
    values(v_invoice.id,v_line_number,v_item->>'description',(v_item->>'quantity')::numeric,nullif(v_item->>'unit_code',''),(v_item->>'unit_price_minor')::bigint,v_line_discount,v_line_charge,coalesce(nullif(v_item->>'tax_type_code',''),'01'),coalesce((v_item->>'tax_rate')::numeric,0),v_line_tax,v_line_subtotal,v_line_subtotal-v_line_discount+v_line_charge+v_line_tax,nullif(v_item->>'classification_code',''),nullif(v_item->>'exemption_reason',''),nullif(v_item->>'country_of_origin',''),nullif(v_item->>'tariff_code',''));
  end loop;
  
  perform public.invoice_audit_event(v_invoice, case when p_invoice_id is null then 'invoice.draft_created' else 'invoice.draft_updated' end); return v_invoice;
end;
$$;
