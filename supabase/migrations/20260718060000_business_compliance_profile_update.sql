create or replace function public.update_business_compliance_profile(
  p_business_id uuid,
  p_msic_code text,
  p_business_activity_description text,
  p_primary_address jsonb,
  p_primary_phone text
)
returns public.businesses
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_business public.businesses;
  primary_address_id uuid;
  primary_phone_id uuid;
  address_line1 text := nullif(btrim(p_primary_address ->> 'line1'), '');
  address_city text := nullif(btrim(p_primary_address ->> 'city'), '');
  address_country text := upper(nullif(btrim(p_primary_address ->> 'country_code'), ''));
begin
  if auth.uid() is null then
    raise exception 'authentication is required' using errcode = '42501';
  end if;
  if not public.has_business_role(p_business_id, array['owner','admin']) then
    raise exception 'business management permission is required' using errcode = '42501';
  end if;
  if nullif(btrim(p_msic_code), '') is null or btrim(p_msic_code) !~ '^\d{5}$' then
    raise exception 'MSIC code must contain exactly 5 digits' using errcode = '22023';
  end if;
  if nullif(btrim(p_business_activity_description), '') is null
     or char_length(btrim(p_business_activity_description)) not between 2 and 300 then
    raise exception 'business activity description must contain 2 to 300 characters' using errcode = '22023';
  end if;
  if jsonb_typeof(p_primary_address) <> 'object'
     or address_line1 is null
     or address_city is null
     or address_country !~ '^[A-Z]{2}$' then
    raise exception 'a complete primary address with a two-letter country code is required' using errcode = '22023';
  end if;
  if nullif(btrim(p_primary_phone), '') is null
     or char_length(btrim(p_primary_phone)) not between 5 and 30 then
    raise exception 'primary phone must contain 5 to 30 characters' using errcode = '22023';
  end if;

  update public.businesses
  set msic_code = btrim(p_msic_code),
      business_activity_description = btrim(p_business_activity_description),
      updated_by = auth.uid(),
      version = version + 1
  where id = p_business_id
  returning * into updated_business;

  if updated_business.id is null then
    raise exception 'business not found' using errcode = 'P0002';
  end if;

  select id into primary_address_id
  from public.business_addresses
  where business_id = p_business_id and is_primary
  order by created_at
  limit 1;

  if primary_address_id is null then
    insert into public.business_addresses (
      business_id, address_type, line1, line2, line3, city, state_code, postal_code, country_code, is_primary
    ) values (
      p_business_id,
      'registered',
      address_line1,
      nullif(btrim(p_primary_address ->> 'line2'), ''),
      nullif(btrim(p_primary_address ->> 'line3'), ''),
      address_city,
      nullif(btrim(p_primary_address ->> 'state_code'), ''),
      nullif(btrim(p_primary_address ->> 'postal_code'), ''),
      address_country,
      true
    );
  else
    update public.business_addresses
    set address_type = 'registered',
        line1 = address_line1,
        line2 = nullif(btrim(p_primary_address ->> 'line2'), ''),
        line3 = nullif(btrim(p_primary_address ->> 'line3'), ''),
        city = address_city,
        state_code = nullif(btrim(p_primary_address ->> 'state_code'), ''),
        postal_code = nullif(btrim(p_primary_address ->> 'postal_code'), ''),
        country_code = address_country
    where id = primary_address_id;
  end if;

  select id into primary_phone_id
  from public.business_contacts
  where business_id = p_business_id and contact_type = 'phone' and is_primary
  order by created_at
  limit 1;

  if primary_phone_id is null then
    insert into public.business_contacts (business_id, contact_type, value, label, is_primary)
    values (p_business_id, 'phone', btrim(p_primary_phone), 'Primary phone', true);
  else
    update public.business_contacts
    set value = btrim(p_primary_phone)
    where id = primary_phone_id;
  end if;

  insert into public.audit_events (
    business_id, actor_user_id, action, entity_type, entity_id, after_summary, source
  ) values (
    p_business_id,
    auth.uid(),
    'business.compliance_updated',
    'business',
    p_business_id,
    jsonb_build_object(
      'updated_fields', jsonb_build_array('msic_code', 'business_activity_description', 'primary_address', 'primary_phone')
    ),
    'web'
  );

  return updated_business;
end;
$$;

revoke all on function public.update_business_compliance_profile(uuid, text, text, jsonb, text) from public;
grant execute on function public.update_business_compliance_profile(uuid, text, text, jsonb, text) to authenticated;

comment on function public.update_business_compliance_profile(uuid, text, text, jsonb, text) is
  'Atomically updates the reusable supplier compliance fields required by active unsigned MyInvois Invoice v1.0 preparation.';
