-- Session 4: private, business-scoped evidence storage. Buckets are deliberately
-- created by migration so local and hosted projects have the same contract.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('transaction-evidence', 'transaction-evidence', false, 26214400, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'text/csv']),
  ('invoice-documents', 'invoice-documents', false, 26214400, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  ('business-assets', 'business-assets', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

alter table public.evidence_files
  add column if not exists storage_deleted_at timestamptz,
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists deletion_requested_by uuid references public.profiles(id) on delete set null;

alter table public.evidence_files
  drop constraint if exists evidence_files_processing_status_check,
  add constraint evidence_files_processing_status_check check (processing_status in (
    'received', 'queued', 'processing', 'needs_review', 'processed', 'succeeded',
    'failed', 'reviewed', 'quarantined', 'delete_pending'
  ));

-- A fixed four-part path prevents path traversal and lets storage RLS derive the
-- business boundary from the first segment: <business>/<entity>/<entity-id>/<uuid>.<ext>.
create or replace function public.storage_object_has_business_path(p_object_name text, p_business_id uuid)
returns boolean language plpgsql stable set search_path = public, storage as $$
declare folders text[] := storage.foldername(p_object_name);
begin
  return cardinality(folders) = 3
    and folders[1] = p_business_id::text
    and folders[2] in ('transaction', 'invoice', 'business')
    and folders[3] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and p_object_name ~* '^[0-9a-f-]{36}/(transaction|invoice|business)/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|pdf|mp3|ogg|wav|csv)$';
end;
$$;

create or replace function public.storage_object_bucket_matches_entity(p_bucket_id text, p_object_name text)
returns boolean language sql stable set search_path = public, storage as $$
  select case (storage.foldername(p_object_name))[2]
    when 'transaction' then p_bucket_id = 'transaction-evidence'
    when 'invoice' then p_bucket_id = 'invoice-documents'
    when 'business' then p_bucket_id = 'business-assets'
    else false
  end;
$$;

create or replace function public.can_access_evidence_object(p_object_name text)
returns boolean language plpgsql stable security definer set search_path = public, storage as $$
declare folders text[] := storage.foldername(p_object_name);
begin
  if cardinality(folders) <> 3 or folders[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.is_business_member(folders[1]::uuid)
    and public.storage_object_has_business_path(p_object_name, folders[1]::uuid);
end;
$$;

create or replace function public.can_upload_evidence_object(p_object_name text)
returns boolean language plpgsql stable security definer set search_path = public, storage as $$
declare folders text[] := storage.foldername(p_object_name);
begin
  if cardinality(folders) <> 3 or folders[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.has_business_role(folders[1]::uuid, array['owner', 'admin', 'accountant', 'staff'])
    and public.storage_object_has_business_path(p_object_name, folders[1]::uuid);
end;
$$;

create or replace function public.can_delete_evidence_object(p_object_name text)
returns boolean language plpgsql stable security definer set search_path = public, storage as $$
declare folders text[] := storage.foldername(p_object_name);
begin
  if cardinality(folders) <> 3 or folders[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.has_business_role(folders[1]::uuid, array['owner', 'admin'])
    and public.storage_object_has_business_path(p_object_name, folders[1]::uuid);
end;
$$;

drop policy if exists evidence_object_read on storage.objects;
drop policy if exists evidence_object_upload on storage.objects;
drop policy if exists evidence_object_delete on storage.objects;

create policy evidence_object_read on storage.objects for select to authenticated
using (public.storage_object_bucket_matches_entity(bucket_id, name) and public.can_access_evidence_object(name));
create policy evidence_object_upload on storage.objects for insert to authenticated
with check (public.storage_object_bucket_matches_entity(bucket_id, name) and public.can_upload_evidence_object(name));
create policy evidence_object_delete on storage.objects for delete to authenticated
using (public.storage_object_bucket_matches_entity(bucket_id, name) and public.can_delete_evidence_object(name));

revoke all on function public.storage_object_has_business_path(text, uuid), public.storage_object_bucket_matches_entity(text, text), public.can_access_evidence_object(text), public.can_upload_evidence_object(text), public.can_delete_evidence_object(text) from public;
grant execute on function public.storage_object_bucket_matches_entity(text, text), public.can_access_evidence_object(text), public.can_upload_evidence_object(text), public.can_delete_evidence_object(text) to authenticated;
