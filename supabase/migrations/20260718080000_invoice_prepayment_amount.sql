create or replace function public.save_invoice_draft(p_business_id uuid, p_invoice_id uuid default null, p_invoice jsonb default '{}'::jsonb, p_items jsonb default '[]'::jsonb)
returns public.invoices language plpgsql security definer set search_path = public as $$
declare v_invoice public.invoices; v_item jsonb; v_subtotal bigint := 0; v_tax bigint := 0; v_discount bigint := 0; v_rounding bigint := coalesce((p_invoice->>'rounding_minor')::bigint, 0); v_prepaid bigint := coalesce((p_invoice->>'prepaid_minor')::bigint, 0);
  v_line_subtotal bigint; v_line_tax bigint; v_line_discount bigint; v_line_charge bigint; v_line_total bigint; v_line_number integer := 0; v_existing boolean := false;
begin
  if not public.has_business_role(p_business_id, array['owner','admin','accountant']) then raise exception 'invoice write permission is required' using errcode='42501'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'an invoice needs at least one line item' using errcode='23514'; end if;
  if v_prepaid < 0 then raise exception 'prepayment cannot be negative' using errcode='23514'; end if;
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
  if v_prepaid > v_subtotal + v_tax + v_rounding then raise exception 'prepayment cannot exceed the invoice total' using errcode='23514'; end if;
  if v_existing then
    update public.invoices set customer_id=nullif(p_invoice->>'customer_id','')::uuid, customer_snapshot=coalesce(p_invoice->'customer_snapshot','{}'::jsonb), supplier_snapshot=coalesce(p_invoice->'supplier_snapshot','{}'::jsonb), issue_date=(p_invoice->>'issue_date')::date, due_date=nullif(p_invoice->>'due_date','')::date, currency=upper(p_invoice->>'currency'), subtotal_minor=v_subtotal, discount_minor=v_discount, tax_minor=v_tax, rounding_minor=v_rounding, prepaid_minor=v_prepaid, total_minor=v_subtotal+v_tax+v_rounding, notes=nullif(p_invoice->>'notes',''), payment_terms=nullif(p_invoice->>'payment_terms',''), updated_by=auth.uid(), version=version+1 where id=p_invoice_id returning * into v_invoice;
    delete from public.invoice_items where invoice_id=p_invoice_id;
  else
    insert into public.invoices(id,business_id,invoice_number,customer_id,customer_snapshot,supplier_snapshot,issue_date,due_date,currency,status,subtotal_minor,discount_minor,tax_minor,rounding_minor,prepaid_minor,total_minor,notes,payment_terms,created_by,updated_by)
    values(coalesce(p_invoice_id,gen_random_uuid()),p_business_id,'DRAFT-' || coalesce(p_invoice_id,gen_random_uuid())::text,nullif(p_invoice->>'customer_id','')::uuid,coalesce(p_invoice->'customer_snapshot','{}'::jsonb),coalesce(p_invoice->'supplier_snapshot','{}'::jsonb),(p_invoice->>'issue_date')::date,nullif(p_invoice->>'due_date','')::date,upper(p_invoice->>'currency'),'draft',v_subtotal,v_discount,v_tax,v_rounding,v_prepaid,v_subtotal+v_tax+v_rounding,nullif(p_invoice->>'notes',''),nullif(p_invoice->>'payment_terms',''),auth.uid(),auth.uid()) returning * into v_invoice;
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

create or replace function public.update_invoice_prepayment(p_business_id uuid, p_invoice_id uuid, p_prepaid_minor bigint)
returns public.invoices language plpgsql security definer set search_path = public as $$
declare result public.invoices;
begin
  if not public.has_business_role(p_business_id, array['owner','admin','accountant']) then
    raise exception 'invoice write permission is required' using errcode='42501';
  end if;
  select * into result from public.invoices where id = p_invoice_id and business_id = p_business_id for update;
  if result.id is null then raise exception 'invoice was not found' using errcode='P0002'; end if;
  if result.status in ('void','cancelled') then raise exception 'prepayment cannot be changed on a void invoice' using errcode='23514'; end if;
  if p_prepaid_minor < 0 or p_prepaid_minor > result.total_minor then
    raise exception 'prepayment must be between zero and the invoice total' using errcode='23514';
  end if;
  if exists (select 1 from public.e_invoice_documents where source_invoice_id = p_invoice_id and active and status = 'approved') then
    raise exception 'prepayment cannot change after e-invoice approval; create a new preparation revision first' using errcode='23514';
  end if;
  update public.invoices set prepaid_minor = p_prepaid_minor, updated_by = auth.uid(), version = version + 1
  where id = p_invoice_id returning * into result;
  perform public.invoice_audit_event(result, 'invoice.prepayment_updated');
  return result;
end;
$$;

revoke all on function public.update_invoice_prepayment(uuid, uuid, bigint) from public;
grant execute on function public.update_invoice_prepayment(uuid, uuid, bigint) to authenticated;

comment on function public.update_invoice_prepayment(uuid, uuid, bigint) is
  'Updates the source-invoice prepayment used by unsigned MyInvois v1.0 preparation, unless an active preparation is already approved.';
