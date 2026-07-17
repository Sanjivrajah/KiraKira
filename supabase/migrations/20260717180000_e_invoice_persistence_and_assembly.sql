-- Stage 1: tenant-scoped e-Invoice preparation persistence.
-- Preparation status is deliberately independent from invoice payment status.

create table public.business_tax_identifiers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  scheme text not null check (scheme in ('tin','sst','tourism_tax','other_tax')),
  value text not null check (char_length(btrim(value)) between 1 and 50),
  issuing_country_code char(2),
  description text,
  is_primary boolean not null default false,
  created_at timestamptz not null default public.current_timestamp_utc(),
  updated_at timestamptz not null default public.current_timestamp_utc(),
  unique (business_id, scheme, value)
);

create unique index business_tax_identifiers_one_primary_per_scheme
  on public.business_tax_identifiers (business_id, scheme) where is_primary;

create table public.business_registration_identifiers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  scheme text not null check (scheme in ('brn','nric','passport','army_number','other')),
  value text not null check (char_length(btrim(value)) between 1 and 50),
  issuing_country_code char(2),
  description text,
  is_primary boolean not null default false,
  created_at timestamptz not null default public.current_timestamp_utc(),
  updated_at timestamptz not null default public.current_timestamp_utc(),
  unique (business_id, scheme, value)
);

create unique index business_registration_identifiers_one_primary
  on public.business_registration_identifiers (business_id) where is_primary;

create trigger business_tax_identifiers_set_updated_at before update on public.business_tax_identifiers
  for each row execute function public.set_updated_at();
create trigger business_registration_identifiers_set_updated_at before update on public.business_registration_identifiers
  for each row execute function public.set_updated_at();

alter table public.invoices
  add column issue_time time,
  add column tax_currency char(3) check (tax_currency is null or tax_currency ~ '^[A-Z]{3}$'),
  add column exchange_rate numeric(20,8) check (exchange_rate is null or exchange_rate > 0),
  add column payment_mode_code text,
  add column bank_account_identifier text,
  add column payment_reference text,
  add column invoice_purpose text,
  add column document_allowances jsonb not null default '[]'::jsonb check (jsonb_typeof(document_allowances) = 'array'),
  add column document_charges jsonb not null default '[]'::jsonb check (jsonb_typeof(document_charges) = 'array'),
  add column prepaid_minor bigint not null default 0 check (prepaid_minor >= 0),
  add column prepayment_date date,
  add column prepayment_time time,
  add column prepayment_reference text,
  add column supplemental_fields jsonb not null default '{}'::jsonb check (jsonb_typeof(supplemental_fields) = 'object');

alter table public.invoice_items
  add column item_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(item_metadata) = 'object');

create table public.e_invoice_documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  source_invoice_id uuid not null references public.invoices(id) on delete restrict,
  source_invoice_revision integer not null check (source_invoice_revision >= 0),
  document_type text not null check (document_type in ('invoice','credit_note','debit_note','refund_note','self_billed_invoice','self_billed_credit_note','self_billed_debit_note','self_billed_refund_note')),
  document_version text not null default '1.1' check (document_version = '1.1'),
  scenario text not null check (scenario in ('b2b_invoice','consolidated_transaction','foreign_buyer','self_billed_invoice','credit_note','debit_note','refund_note','tax_exempt','foreign_currency','import_export','shipping_recipient')),
  canonical_document jsonb check (canonical_document is null or jsonb_typeof(canonical_document) = 'object'),
  supplier_snapshot jsonb not null check (jsonb_typeof(supplier_snapshot) = 'object'),
  buyer_snapshot jsonb not null check (jsonb_typeof(buyer_snapshot) = 'object'),
  supplemental_fields jsonb not null default '{}'::jsonb check (jsonb_typeof(supplemental_fields) = 'object'),
  provenance jsonb not null default '{}'::jsonb check (jsonb_typeof(provenance) = 'object'),
  readiness_result jsonb not null check (jsonb_typeof(readiness_result) = 'object'),
  status text not null check (status in ('needs_information','ready','approved')),
  revision integer not null default 0 check (revision >= 0),
  approved_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default public.current_timestamp_utc(),
  updated_at timestamptz not null default public.current_timestamp_utc(),
  check ((status = 'approved') = (approved_at is not null and approved_by is not null)),
  check (status = 'needs_information' or canonical_document is not null)
);

create unique index e_invoice_documents_active_source_revision
  on public.e_invoice_documents (business_id, source_invoice_id, source_invoice_revision);
create index e_invoice_documents_business_status_updated
  on public.e_invoice_documents (business_id, status, updated_at desc);
create trigger e_invoice_documents_set_updated_at before update on public.e_invoice_documents
  for each row execute function public.set_updated_at();

create or replace function public.assert_e_invoice_same_business()
returns trigger language plpgsql security definer set search_path = public as $$
declare source_business_id uuid;
begin
  select business_id into source_business_id from public.invoices where id = new.source_invoice_id;
  if source_business_id is null or source_business_id is distinct from new.business_id then
    raise exception 'cross-business e-invoice source is not allowed' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger e_invoice_documents_same_business before insert or update on public.e_invoice_documents
  for each row execute function public.assert_e_invoice_same_business();

create or replace function public.prevent_approved_e_invoice_changes()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.status = 'approved' and new is distinct from old then
    raise exception 'approved e-invoice preparation revisions are immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger e_invoice_documents_approved_immutable before update on public.e_invoice_documents
  for each row execute function public.prevent_approved_e_invoice_changes();

alter table public.business_tax_identifiers enable row level security;
alter table public.business_registration_identifiers enable row level security;
alter table public.e_invoice_documents enable row level security;

create policy business_tax_identifiers_read on public.business_tax_identifiers for select to authenticated
  using (public.is_business_member(business_id));
create policy business_tax_identifiers_manage on public.business_tax_identifiers for all to authenticated
  using (public.can_manage_business(business_id)) with check (public.can_manage_business(business_id));
create policy business_registration_identifiers_read on public.business_registration_identifiers for select to authenticated
  using (public.is_business_member(business_id));
create policy business_registration_identifiers_manage on public.business_registration_identifiers for all to authenticated
  using (public.can_manage_business(business_id)) with check (public.can_manage_business(business_id));
create policy e_invoice_documents_read on public.e_invoice_documents for select to authenticated
  using (public.is_business_member(business_id));
create policy e_invoice_documents_write on public.e_invoice_documents for insert to authenticated
  with check (status <> 'approved' and public.has_business_role(business_id, array['owner','admin','accountant']));
create policy e_invoice_documents_update on public.e_invoice_documents for update to authenticated
  using (public.has_business_role(business_id, array['owner','admin','accountant']))
  with check (status <> 'approved' and public.has_business_role(business_id, array['owner','admin','accountant']));

create or replace function public.save_e_invoice_supplemental_fields(
  p_business_id uuid,
  p_document_id uuid,
  p_expected_revision integer,
  p_supplemental_fields jsonb
)
returns public.e_invoice_documents
language plpgsql security definer set search_path = public as $$
declare result public.e_invoice_documents;
begin
  if not public.has_business_role(p_business_id, array['owner','admin','accountant']) then
    raise exception 'e-invoice write permission is required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_supplemental_fields) <> 'object' then
    raise exception 'supplemental fields must be an object' using errcode = '22023';
  end if;
  update public.e_invoice_documents
    set supplemental_fields = p_supplemental_fields,
        revision = revision + 1
    where id = p_document_id and business_id = p_business_id
      and revision = p_expected_revision and status <> 'approved'
    returning * into result;
  if result.id is null then
    raise exception 'stale or immutable e-invoice preparation revision' using errcode = '40001';
  end if;
  return result;
end;
$$;

create or replace function public.approve_e_invoice_document(
  p_business_id uuid,
  p_document_id uuid,
  p_expected_revision integer
)
returns public.e_invoice_documents
language plpgsql security definer set search_path = public as $$
declare result public.e_invoice_documents;
begin
  if not public.has_business_role(p_business_id, array['owner','admin']) then
    raise exception 'e-invoice approval permission is required' using errcode = '42501';
  end if;
  update public.e_invoice_documents
    set status = 'approved', approved_at = now(), approved_by = auth.uid(), revision = revision + 1
    where id = p_document_id and business_id = p_business_id
      and revision = p_expected_revision and status = 'ready' and canonical_document is not null
    returning * into result;
  if result.id is null then
    raise exception 'only the current ready revision can be approved' using errcode = '40001';
  end if;
  return result;
end;
$$;

create or replace function public.save_invoice_compliance_details(
  p_business_id uuid,
  p_invoice_id uuid,
  p_document jsonb,
  p_supplier_snapshot jsonb,
  p_buyer_snapshot jsonb,
  p_supplemental_fields jsonb default '{}'::jsonb
)
returns public.invoices
language plpgsql security definer set search_path = public as $$
declare result public.invoices; line jsonb; line_index integer := 0;
begin
  if not public.has_business_role(p_business_id, array['owner','admin','accountant']) then
    raise exception 'invoice write permission is required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_document) <> 'object' or jsonb_typeof(p_supplier_snapshot) <> 'object'
    or jsonb_typeof(p_buyer_snapshot) <> 'object' or jsonb_typeof(p_supplemental_fields) <> 'object' then
    raise exception 'canonical document, snapshots and supplemental fields must be objects' using errcode = '22023';
  end if;
  select * into result from public.invoices where id = p_invoice_id and business_id = p_business_id for update;
  if result.id is null then raise exception 'invoice was not found' using errcode = 'P0002'; end if;
  if result.status <> 'draft' then raise exception 'compliance details can only be saved on a draft invoice' using errcode = '23514'; end if;
  update public.invoices set
    customer_snapshot = p_buyer_snapshot,
    supplier_snapshot = p_supplier_snapshot,
    issue_time = nullif(p_document->>'issueTime', '')::time,
    tax_currency = nullif(p_document->>'taxCurrency', ''),
    exchange_rate = nullif(p_document->>'exchangeRate', '')::numeric,
    payment_mode_code = nullif(p_document#>>'{paymentInstructions,paymentModeCode}', ''),
    bank_account_identifier = nullif(p_document#>>'{paymentInstructions,bankAccountIdentifier}', ''),
    payment_reference = nullif(p_document#>>'{paymentInstructions,paymentReference}', ''),
    billing_period_start = nullif(p_document#>>'{billingPeriod,startDate}', '')::date,
    billing_period_end = nullif(p_document#>>'{billingPeriod,endDate}', '')::date,
    document_references = coalesce(p_document->'references', '[]'::jsonb),
    document_allowances = coalesce(p_document->'allowances', '[]'::jsonb),
    document_charges = coalesce(p_document->'charges', '[]'::jsonb),
    prepaid_minor = round(coalesce((p_document#>>'{monetaryTotals,prepaidAmount,amount}')::numeric, 0) * 100)::bigint,
    invoice_purpose = nullif(p_document->>'invoicePurpose', ''),
    supplemental_fields = p_supplemental_fields,
    updated_by = auth.uid(),
    version = version + 1
  where id = p_invoice_id
  returning * into result;
  for line in select value from jsonb_array_elements(coalesce(p_document->'lines', '[]'::jsonb)) loop
    line_index := line_index + 1;
    update public.invoice_items set
      country_of_origin = nullif(line#>>'{itemMetadata,countryOfOrigin}', ''),
      tariff_code = nullif(line#>>'{itemMetadata,tariffCode}', ''),
      item_metadata = coalesce(line->'itemMetadata', '{}'::jsonb)
    where invoice_id = p_invoice_id and line_number = line_index;
  end loop;
  return result;
end;
$$;

-- Recreate business creation with normalized compliance identity inputs.
drop function public.create_business(text, text, text, text, text, text);
create function public.create_business(
  p_legal_name text,
  p_trading_name text default null,
  p_entity_type text default 'other',
  p_preferred_language text default 'en',
  p_msic_code text default null,
  p_business_activity_description text default null,
  p_tin text default null,
  p_registration_scheme text default null,
  p_registration_value text default null,
  p_registration_country_code text default 'MY',
  p_sst_registration text default null,
  p_tourism_tax_registration text default null,
  p_primary_address jsonb default null,
  p_primary_email text default null,
  p_primary_phone text default null
)
returns public.businesses
language plpgsql security definer set search_path = public as $$
declare created_business public.businesses; caller_id uuid := auth.uid();
begin
  if caller_id is null then raise exception 'authentication is required' using errcode = '42501'; end if;
  if (p_registration_scheme is null) <> (p_registration_value is null) then
    raise exception 'registration scheme and value must be supplied together' using errcode = '22023';
  end if;
  if p_registration_scheme is not null and p_registration_scheme not in ('brn','nric','passport','army_number','other') then
    raise exception 'invalid registration scheme' using errcode = '22023';
  end if;
  if p_primary_address is not null and (
    jsonb_typeof(p_primary_address) <> 'object' or nullif(btrim(p_primary_address->>'line1'), '') is null
    or nullif(btrim(p_primary_address->>'city'), '') is null or coalesce(p_primary_address->>'country_code', '') !~ '^[A-Z]{2}$'
  ) then raise exception 'primary address requires line1, city and alpha-2 country code' using errcode = '22023'; end if;
  insert into public.profiles (id) values (caller_id) on conflict (id) do nothing;
  insert into public.businesses (owner_user_id, legal_name, trading_name, entity_type, preferred_language, msic_code, business_activity_description, created_by, updated_by)
  values (caller_id, p_legal_name, nullif(btrim(p_trading_name), ''), p_entity_type, p_preferred_language, nullif(btrim(p_msic_code), ''), nullif(btrim(p_business_activity_description), ''), caller_id, caller_id)
  returning * into created_business;
  insert into public.business_members (business_id, user_id, role, status, accepted_at)
  values (created_business.id, caller_id, 'owner', 'active', now());
  insert into public.business_settings (business_id) values (created_business.id);
  if nullif(btrim(p_tin), '') is not null then
    insert into public.business_tax_identifiers (business_id, scheme, value, issuing_country_code, is_primary)
    values (created_business.id, 'tin', btrim(p_tin), 'MY', true);
  end if;
  if nullif(btrim(p_registration_value), '') is not null then
    insert into public.business_registration_identifiers (business_id, scheme, value, issuing_country_code, is_primary)
    values (created_business.id, p_registration_scheme, btrim(p_registration_value), upper(p_registration_country_code), true);
  end if;
  if nullif(btrim(p_sst_registration), '') is not null then
    insert into public.business_tax_identifiers (business_id, scheme, value, issuing_country_code, is_primary)
    values (created_business.id, 'sst', btrim(p_sst_registration), 'MY', true);
  end if;
  if nullif(btrim(p_tourism_tax_registration), '') is not null then
    insert into public.business_tax_identifiers (business_id, scheme, value, issuing_country_code, is_primary)
    values (created_business.id, 'tourism_tax', btrim(p_tourism_tax_registration), 'MY', true);
  end if;
  if p_primary_address is not null then
    insert into public.business_addresses (business_id, address_type, line1, line2, line3, city, state_code, postal_code, country_code, is_primary)
    values (created_business.id, 'registered', btrim(p_primary_address->>'line1'), nullif(btrim(p_primary_address->>'line2'), ''), nullif(btrim(p_primary_address->>'line3'), ''), btrim(p_primary_address->>'city'), nullif(btrim(p_primary_address->>'state_code'), ''), nullif(btrim(p_primary_address->>'postal_code'), ''), upper(p_primary_address->>'country_code'), true);
  end if;
  if nullif(btrim(p_primary_email), '') is not null then
    insert into public.business_contacts (business_id, contact_type, value, is_primary) values (created_business.id, 'email', btrim(p_primary_email), true);
  end if;
  if nullif(btrim(p_primary_phone), '') is not null then
    insert into public.business_contacts (business_id, contact_type, value, is_primary) values (created_business.id, 'phone', btrim(p_primary_phone), true);
  end if;
  insert into public.audit_events (business_id, actor_user_id, action, entity_type, entity_id, after_summary, source)
  values (created_business.id, caller_id, 'business.created', 'business', created_business.id, jsonb_build_object('legal_name', created_business.legal_name), 'web');
  return created_business;
end;
$$;

revoke all on public.business_tax_identifiers, public.business_registration_identifiers, public.e_invoice_documents from anon;
grant select, insert, update, delete on public.business_tax_identifiers, public.business_registration_identifiers, public.e_invoice_documents to authenticated;

revoke all on function public.assert_e_invoice_same_business(), public.prevent_approved_e_invoice_changes() from public;
revoke all on function public.save_e_invoice_supplemental_fields(uuid, uuid, integer, jsonb), public.approve_e_invoice_document(uuid, uuid, integer), public.save_invoice_compliance_details(uuid, uuid, jsonb, jsonb, jsonb, jsonb) from public;
revoke all on function public.create_business(text, text, text, text, text, text, text, text, text, text, text, text, jsonb, text, text) from public;
grant execute on function public.save_e_invoice_supplemental_fields(uuid, uuid, integer, jsonb), public.approve_e_invoice_document(uuid, uuid, integer), public.save_invoice_compliance_details(uuid, uuid, jsonb, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.create_business(text, text, text, text, text, text, text, text, text, text, text, text, jsonb, text, text) to authenticated;
