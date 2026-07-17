-- Supabase installs pgcrypto in the extensions schema. The payload trigger has
-- a restricted search path, so its hash function must be schema-qualified.

create or replace function public.assert_e_invoice_payload_snapshot_source()
returns trigger language plpgsql security definer set search_path = public as $$
declare source public.e_invoice_documents;
begin
  if jsonb_typeof(new.unsigned_payload::jsonb) <> 'object' then
    raise exception 'unsigned payload must be a JSON object' using errcode = '22023';
  end if;
  if encode(extensions.digest(convert_to(new.unsigned_payload, 'UTF8'), 'sha256'), 'hex')
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
