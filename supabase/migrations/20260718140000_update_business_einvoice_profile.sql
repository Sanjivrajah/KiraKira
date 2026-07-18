create or replace function public.update_business_einvoice_profile(p_business_id uuid, p_profile jsonb)
returns public.businesses language plpgsql security definer set search_path = public as $$
declare
  result public.businesses;
  v_country_code text := upper(coalesce(nullif(btrim(p_profile ->> 'countryCode'), ''), 'MY'));
  v_registration_scheme text := p_profile ->> 'registrationScheme';
begin
  if not public.has_business_role(p_business_id, array['owner','admin']) then raise exception 'business management permission is required' using errcode = '42501'; end if;
  if nullif(btrim(p_profile ->> 'legalName'), '') is null or nullif(btrim(p_profile ->> 'tin'), '') is null
     or nullif(btrim(p_profile ->> 'registrationNumber'), '') is null
     or v_registration_scheme not in ('brn','nric','passport','army_number','other') then
    raise exception 'supplier legal name, TIN and registration are required' using errcode = '22023';
  end if;
  perform public.update_business_compliance_profile(
    p_business_id, p_profile ->> 'msicCode', p_profile ->> 'businessActivityDescription',
    jsonb_build_object('line1', p_profile ->> 'addressLine1', 'line2', p_profile ->> 'addressLine2',
      'city', p_profile ->> 'city', 'postal_code', p_profile ->> 'postcode',
      'state_code', p_profile ->> 'stateCode', 'country_code', v_country_code),
    p_profile ->> 'phone'
  );
  update public.businesses set legal_name = btrim(p_profile ->> 'legalName'), updated_by = auth.uid(), version = version + 1
  where id = p_business_id returning * into result;
  delete from public.business_tax_identifiers where business_id = p_business_id and scheme = 'tin';
  insert into public.business_tax_identifiers (business_id, scheme, value, issuing_country_code, is_primary)
  values (p_business_id, 'tin', btrim(p_profile ->> 'tin'), v_country_code, true);
  delete from public.business_registration_identifiers where business_id = p_business_id;
  insert into public.business_registration_identifiers (business_id, scheme, value, issuing_country_code, is_primary)
  values (p_business_id, v_registration_scheme, btrim(p_profile ->> 'registrationNumber'), v_country_code, true);
  if nullif(btrim(p_profile ->> 'email'), '') is not null then
    update public.business_contacts set value = btrim(p_profile ->> 'email')
    where id = (select id from public.business_contacts where business_id = p_business_id and contact_type = 'email' order by is_primary desc, created_at limit 1);
    if not found then insert into public.business_contacts (business_id, contact_type, value, label, is_primary)
      values (p_business_id, 'email', btrim(p_profile ->> 'email'), 'Primary email', true); end if;
  end if;
  insert into public.audit_events (business_id, actor_user_id, action, entity_type, entity_id, after_summary, source)
  values (p_business_id, auth.uid(), 'business.einvoice_identity_updated', 'business', p_business_id,
    jsonb_build_object('updated_fields', jsonb_build_array('legal_name','tin','registration','email')), 'web');
  return result;
end;
$$;
revoke all on function public.update_business_einvoice_profile(uuid, jsonb) from public;
grant execute on function public.update_business_einvoice_profile(uuid, jsonb) to authenticated;
