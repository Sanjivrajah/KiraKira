create or replace function public.update_party_einvoice_profile(
  p_business_id uuid,
  p_party_id uuid,
  p_party jsonb
)
returns public.parties
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.parties;
  billing_address_id uuid;
  v_country_code text := upper(nullif(btrim(p_party ->> 'countryCode'), ''));
  v_state_code text := nullif(btrim(p_party ->> 'stateCode'), '');
begin
  if not public.has_business_role(p_business_id, array['owner','admin','accountant']) then
    raise exception 'customer write permission is required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_party) <> 'object'
     or nullif(btrim(p_party ->> 'legalName'), '') is null
     or nullif(btrim(p_party ->> 'tin'), '') is null
     or nullif(btrim(p_party ->> 'registrationValue'), '') is null
     or nullif(btrim(p_party ->> 'phone'), '') is null
     or nullif(btrim(p_party ->> 'addressLine1'), '') is null
     or nullif(btrim(p_party ->> 'city'), '') is null
     or v_country_code !~ '^[A-Z]{2}$' then
    raise exception 'complete customer identity, contact and address fields are required' using errcode = '22023';
  end if;
  if p_party ->> 'registrationScheme' not in ('brn','nric','passport','army_number','other') then
    raise exception 'invalid customer registration scheme' using errcode = '22023';
  end if;
  if v_country_code = 'MY' and (v_state_code is null or v_state_code !~ '^(0[1-9]|1[0-6])$') then
    raise exception 'Malaysian customer state must be an official code from 01 to 16' using errcode = '22023';
  end if;

  update public.parties
  set legal_name = btrim(p_party ->> 'legalName'),
      kind = coalesce(nullif(p_party ->> 'kind', ''), kind),
      email = nullif(btrim(p_party ->> 'email'), ''),
      phone = btrim(p_party ->> 'phone'),
      updated_by = auth.uid(),
      version = version + 1
  where id = p_party_id and business_id = p_business_id
  returning * into result;
  if result.id is null then raise exception 'customer was not found' using errcode = 'P0002'; end if;

  delete from public.party_tax_identifiers where party_id = p_party_id and scheme = 'tin';
  insert into public.party_tax_identifiers (party_id, scheme, value, issuing_country_code)
  values (p_party_id, 'tin', btrim(p_party ->> 'tin'), v_country_code);

  delete from public.party_registration_identifiers where party_id = p_party_id;
  insert into public.party_registration_identifiers (party_id, scheme, value, issuing_country_code)
  values (p_party_id, p_party ->> 'registrationScheme', btrim(p_party ->> 'registrationValue'), v_country_code);

  select id into billing_address_id
  from public.party_addresses
  where party_id = p_party_id and address_type = 'billing'
  order by is_primary desc, created_at
  limit 1;
  if billing_address_id is null then
    insert into public.party_addresses (
      party_id, address_type, line1, line2, city, postal_code, state_code, country_code, is_primary
    ) values (
      p_party_id, 'billing', btrim(p_party ->> 'addressLine1'), nullif(btrim(p_party ->> 'addressLine2'), ''),
      btrim(p_party ->> 'city'), nullif(btrim(p_party ->> 'postcode'), ''), v_state_code, v_country_code, true
    );
  else
    update public.party_addresses
    set line1 = btrim(p_party ->> 'addressLine1'),
        line2 = nullif(btrim(p_party ->> 'addressLine2'), ''),
        city = btrim(p_party ->> 'city'),
        postal_code = nullif(btrim(p_party ->> 'postcode'), ''),
        state_code = v_state_code,
        country_code = v_country_code,
        is_primary = true
    where id = billing_address_id;
  end if;

  insert into public.audit_events (business_id, actor_user_id, action, entity_type, entity_id, after_summary, source)
  values (p_business_id, auth.uid(), 'party.einvoice_profile_updated', 'party', p_party_id,
    jsonb_build_object('updated_fields', jsonb_build_array('identity','contact','billing_address')), 'web');
  return result;
end;
$$;

revoke all on function public.update_party_einvoice_profile(uuid, uuid, jsonb) from public;
grant execute on function public.update_party_einvoice_profile(uuid, uuid, jsonb) to authenticated;

comment on function public.update_party_einvoice_profile(uuid, uuid, jsonb) is
  'Atomically updates the reusable buyer fields required by standard MyInvois Invoice v1.0 preparation.';

create or replace function public.save_invoice_draft_with_metadata(
  p_business_id uuid,
  p_invoice_id uuid default null,
  p_invoice jsonb default '{}'::jsonb,
  p_items jsonb default '[]'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns public.invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.invoices;
  v_document_type text := coalesce(nullif(p_metadata ->> 'documentType', ''), 'invoice');
begin
  if v_document_type not in ('invoice','credit_note','debit_note','refund_note','self_billed_invoice','self_billed_credit_note','self_billed_debit_note','self_billed_refund_note') then
    raise exception 'invalid invoice document type' using errcode = '22023';
  end if;
  if nullif(btrim(p_metadata ->> 'invoiceNumber'), '') is null
     or nullif(btrim(p_metadata ->> 'issueTime'), '') is null then
    raise exception 'document number and issue time are required' using errcode = '22023';
  end if;
  result := public.save_invoice_draft(p_business_id, p_invoice_id, p_invoice, p_items);
  update public.invoices
  set invoice_number = btrim(p_metadata ->> 'invoiceNumber'),
      document_type = v_document_type,
      issue_time = (p_metadata ->> 'issueTime')::time,
      payment_mode_code = nullif(btrim(p_metadata ->> 'paymentModeCode'), ''),
      bank_account_identifier = nullif(btrim(p_metadata ->> 'bankAccountIdentifier'), ''),
      document_references = coalesce(p_metadata -> 'documentReferences', '[]'::jsonb)
  where id = result.id and business_id = p_business_id and status = 'draft'
  returning * into result;
  return result;
end;
$$;

revoke all on function public.save_invoice_draft_with_metadata(uuid, uuid, jsonb, jsonb, jsonb) from public;
grant execute on function public.save_invoice_draft_with_metadata(uuid, uuid, jsonb, jsonb, jsonb) to authenticated;

comment on function public.save_invoice_draft_with_metadata(uuid, uuid, jsonb, jsonb, jsonb) is
  'Atomically saves editable invoice lines and the document metadata required for MyInvois preparation.';
