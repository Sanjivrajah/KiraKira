-- Stage 3: exact unsigned UBL JSON bytes and immutable generation metadata.

create table public.e_invoice_payload_snapshots (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  e_invoice_document_id uuid not null references public.e_invoice_documents(id) on delete restrict,
  document_revision integer not null check (document_revision >= 0),
  document_version text not null check (document_version in ('1.0', '1.1')),
  mapper_version text not null check (char_length(btrim(mapper_version)) between 1 and 100),
  reference_data_version text not null check (char_length(btrim(reference_data_version)) between 1 and 100),
  format text not null check (format = 'json'),
  unsigned_payload text not null check (octet_length(unsigned_payload) between 1 and 307200),
  unsigned_payload_hash text not null check (unsigned_payload_hash ~ '^[0-9a-f]{64}$'),
  payload_size_bytes integer not null check (payload_size_bytes = octet_length(unsigned_payload) and payload_size_bytes <= 307200),
  generated_at timestamptz not null,
  unique (e_invoice_document_id, document_revision, document_version, mapper_version, reference_data_version, format)
);

create index e_invoice_payload_snapshots_business_generated
  on public.e_invoice_payload_snapshots (business_id, generated_at desc);

create function public.assert_e_invoice_payload_snapshot_source()
returns trigger language plpgsql security definer set search_path = public as $$
declare source public.e_invoice_documents;
begin
  if jsonb_typeof(new.unsigned_payload::jsonb) <> 'object' then
    raise exception 'unsigned payload must be a JSON object' using errcode = '22023';
  end if;
  if encode(digest(convert_to(new.unsigned_payload, 'UTF8'), 'sha256'), 'hex')
    is distinct from new.unsigned_payload_hash then
    raise exception 'unsigned payload hash does not match the exact UTF-8 bytes' using errcode = '23514';
  end if;
  select * into source from public.e_invoice_documents where id = new.e_invoice_document_id;
  if source.id is null or source.business_id is distinct from new.business_id then
    raise exception 'cross-business payload snapshot source is not allowed' using errcode = '23514';
  end if;
  if source.status <> 'approved' or not source.active or not source.submission_eligible
    or source.revision is distinct from new.document_revision then
    raise exception 'payload snapshots require the active approved document revision' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger e_invoice_payload_snapshots_validate_source
  before insert on public.e_invoice_payload_snapshots
  for each row execute function public.assert_e_invoice_payload_snapshot_source();

alter table public.e_invoice_payload_snapshots enable row level security;
create policy e_invoice_payload_snapshots_read on public.e_invoice_payload_snapshots
  for select to authenticated using (public.is_business_member(business_id));
create policy e_invoice_payload_snapshots_insert on public.e_invoice_payload_snapshots
  for insert to authenticated
  with check (public.has_business_role(business_id, array['owner','admin']));

revoke update, delete, truncate on public.e_invoice_payload_snapshots from anon, authenticated;
grant select, insert on public.e_invoice_payload_snapshots to authenticated;
