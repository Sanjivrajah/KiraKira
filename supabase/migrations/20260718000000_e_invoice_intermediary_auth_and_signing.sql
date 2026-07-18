-- Stage 4: non-secret MyInvois connection references and immutable signed payload bytes.

create table public.myinvois_connections (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  environment text not null check (environment in ('sandbox', 'production')),
  auth_mode text not null check (auth_mode = 'intermediary'),
  taxpayer_tin text not null check (taxpayer_tin ~ '^[A-Z]{1,2}[0-9]{8,14}$'),
  taxpayer_registration_scheme text check (taxpayer_registration_scheme is null or taxpayer_registration_scheme = 'ROB'),
  taxpayer_registration_value text,
  onbehalfof_value text generated always as (
    case when taxpayer_registration_value is null then taxpayer_tin
      else taxpayer_tin || ':' || taxpayer_registration_value end
  ) stored,
  credential_set_id text not null check (char_length(btrim(credential_set_id)) between 1 and 100),
  client_id_secret_ref text not null check (char_length(btrim(client_id_secret_ref)) between 1 and 300),
  client_secret_secret_ref text not null check (char_length(btrim(client_secret_secret_ref)) between 1 and 300),
  signing_certificate_secret_ref text check (signing_certificate_secret_ref is null or char_length(btrim(signing_certificate_secret_ref)) between 1 and 300),
  signing_private_key_secret_ref text check (signing_private_key_secret_ref is null or char_length(btrim(signing_private_key_secret_ref)) between 1 and 300),
  signing_key_passphrase_secret_ref text,
  signing_certificate_chain_secret_ref text,
  enabled boolean not null default false,
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  certificate_thumbprint text check (certificate_thumbprint is null or certificate_thumbprint ~ '^[0-9a-f]{64}$'),
  certificate_subject text,
  certificate_issuer text,
  certificate_serial_number text,
  certificate_not_before timestamptz,
  certificate_not_after timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, environment),
  check ((taxpayer_registration_scheme is null) = (taxpayer_registration_value is null)),
  check (taxpayer_registration_value is null or taxpayer_registration_value ~ '^[A-Z0-9-]{1,30}$'),
  check (verified_at is not null or verified_by is null),
  check (certificate_not_before is null or certificate_not_after > certificate_not_before)
);

create trigger myinvois_connections_set_updated_at
  before update on public.myinvois_connections
  for each row execute function public.set_updated_at();

create table public.e_invoice_signed_snapshots (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  unsigned_snapshot_id uuid not null references public.e_invoice_payload_snapshots(id) on delete restrict,
  unsigned_payload_hash text not null check (unsigned_payload_hash ~ '^[0-9a-f]{64}$'),
  signed_payload text not null check (octet_length(signed_payload) between 1 and 307200),
  signed_payload_hash text not null check (signed_payload_hash ~ '^[0-9a-f]{64}$'),
  certificate_thumbprint text not null check (certificate_thumbprint ~ '^[0-9a-f]{64}$'),
  certificate_subject text not null,
  certificate_issuer text not null,
  certificate_serial_number text not null,
  certificate_not_after timestamptz not null,
  signing_algorithm text not null check (signing_algorithm = 'RSA-SHA256'),
  implementation_version text not null check (char_length(btrim(implementation_version)) between 1 and 100),
  environment text not null check (environment in ('sandbox', 'production')),
  connection_id uuid not null references public.myinvois_connections(id) on delete restrict,
  signing_timestamp timestamptz not null,
  created_at timestamptz not null default now(),
  unique (unsigned_snapshot_id, certificate_thumbprint, implementation_version)
);

create index e_invoice_signed_snapshots_business_created
  on public.e_invoice_signed_snapshots (business_id, created_at desc);

create function public.assert_e_invoice_signed_snapshot_source()
returns trigger language plpgsql security definer set search_path = public as $$
declare source public.e_invoice_payload_snapshots;
declare approved_source public.e_invoice_documents;
declare signed_document jsonb;
declare signing_connection public.myinvois_connections;
begin
  select * into source from public.e_invoice_payload_snapshots where id = new.unsigned_snapshot_id;
  if source.id is null or source.business_id is distinct from new.business_id then
    raise exception 'cross-business signed snapshot source is not allowed' using errcode = '23514';
  end if;
  if source.unsigned_payload_hash is distinct from new.unsigned_payload_hash then
    raise exception 'signed snapshot unsigned hash does not match its immutable source' using errcode = '23514';
  end if;
  select * into approved_source from public.e_invoice_documents where id = source.e_invoice_document_id;
  if approved_source.status <> 'approved' or not approved_source.active
    or not approved_source.submission_eligible
    or approved_source.revision is distinct from source.document_revision then
    raise exception 'signed snapshots require the active approved document revision' using errcode = '23514';
  end if;
  if encode(digest(convert_to(new.signed_payload, 'UTF8'), 'sha256'), 'hex')
    is distinct from new.signed_payload_hash then
    raise exception 'signed payload hash does not match the exact UTF-8 bytes' using errcode = '23514';
  end if;
  signed_document := new.signed_payload::jsonb;
  if jsonb_typeof(signed_document) <> 'object'
    or signed_document #> '{Invoice,0,UBLExtensions}' is null
    or signed_document #> '{Invoice,0,Signature}' is null then
    raise exception 'signed payload must contain the MyInvois UBL signature structures' using errcode = '23514';
  end if;
  if new.signing_timestamp >= new.certificate_not_after then
    raise exception 'signing certificate was expired at the signing timestamp' using errcode = '23514';
  end if;
  select * into signing_connection from public.myinvois_connections where id = new.connection_id;
  if signing_connection.id is null or signing_connection.business_id is distinct from new.business_id
    or signing_connection.environment is distinct from new.environment then
    raise exception 'signed snapshot connection does not match its business and environment' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger e_invoice_signed_snapshots_validate_source
  before insert on public.e_invoice_signed_snapshots
  for each row execute function public.assert_e_invoice_signed_snapshot_source();

alter table public.myinvois_connections enable row level security;
alter table public.e_invoice_signed_snapshots enable row level security;

create policy myinvois_connections_manage on public.myinvois_connections
  for all to authenticated
  using (public.has_business_role(business_id, array['owner','admin','accountant']))
  with check (public.has_business_role(business_id, array['owner','admin','accountant']));

create policy e_invoice_signed_snapshots_read on public.e_invoice_signed_snapshots
  for select to authenticated using (public.is_business_member(business_id));
create policy e_invoice_signed_snapshots_insert on public.e_invoice_signed_snapshots
  for insert to authenticated
  with check (public.has_business_role(business_id, array['owner','admin','accountant']));

revoke update, delete, truncate on public.e_invoice_signed_snapshots from anon, authenticated;
revoke all on public.myinvois_connections, public.e_invoice_signed_snapshots from anon;
grant select, insert, update on public.myinvois_connections to authenticated;
grant select, insert on public.e_invoice_signed_snapshots to authenticated;
