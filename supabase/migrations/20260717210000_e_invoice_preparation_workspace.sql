-- Stage 2: preparation revisions, authoritative approval, and active-source eligibility.

alter table public.e_invoice_documents
  add column supersedes_document_id uuid references public.e_invoice_documents(id) on delete restrict,
  add column active boolean not null default true,
  add column submission_eligible boolean not null default false;

alter table public.e_invoice_documents drop constraint if exists e_invoice_documents_provenance_check;
alter table public.e_invoice_documents
  add constraint e_invoice_documents_provenance_check check (jsonb_typeof(provenance) = 'array');
alter table public.e_invoice_documents alter column provenance set default '[]'::jsonb;

drop index if exists public.e_invoice_documents_active_source_revision;
create unique index e_invoice_documents_one_active_source_revision
  on public.e_invoice_documents (business_id, source_invoice_id, source_invoice_revision)
  where active;
create index e_invoice_documents_revision_history
  on public.e_invoice_documents (business_id, source_invoice_id, source_invoice_revision, created_at);

create or replace function public.prevent_approved_e_invoice_changes()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.status = 'approved'
    and (to_jsonb(new) - array['active','submission_eligible','updated_at'])
      is distinct from (to_jsonb(old) - array['active','submission_eligible','updated_at']) then
    raise exception 'approved e-invoice preparation revisions are immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop function if exists public.approve_e_invoice_document(uuid, uuid, integer);
create function public.approve_e_invoice_document(
  p_business_id uuid,
  p_document_id uuid,
  p_expected_revision integer,
  p_readiness_result jsonb
)
returns public.e_invoice_documents
language plpgsql security definer set search_path = public as $$
declare result public.e_invoice_documents;
begin
  if not public.has_business_role(p_business_id, array['owner','admin']) then
    raise exception 'e-invoice approval permission is required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_readiness_result) <> 'object'
    or coalesce((p_readiness_result->>'ready')::boolean, false) is not true
    or exists (
      select 1 from jsonb_array_elements(coalesce(p_readiness_result->'diagnostics', '[]'::jsonb)) diagnostic
      where diagnostic->>'severity' = 'error'
    ) then
    raise exception 'authoritative internal preparation checks must pass before approval' using errcode = '23514';
  end if;
  update public.e_invoice_documents
    set status = 'approved', readiness_result = p_readiness_result,
        approved_at = now(), approved_by = auth.uid(),
        submission_eligible = true, revision = revision + 1
    where id = p_document_id and business_id = p_business_id and active
      and revision = p_expected_revision and status = 'ready' and canonical_document is not null
    returning * into result;
  if result.id is null then
    raise exception 'only the current ready revision can be approved' using errcode = '40001';
  end if;
  return result;
end;
$$;

create function public.create_e_invoice_revision(p_business_id uuid, p_document_id uuid)
returns public.e_invoice_documents
language plpgsql security definer set search_path = public as $$
declare prior public.e_invoice_documents; created public.e_invoice_documents;
begin
  if not public.has_business_role(p_business_id, array['owner','admin','accountant']) then
    raise exception 'e-invoice write permission is required' using errcode = '42501';
  end if;
  select * into prior from public.e_invoice_documents
    where id = p_document_id and business_id = p_business_id and status = 'approved' and active
    for update;
  if prior.id is null then
    raise exception 'only the active approved preparation can start a new revision' using errcode = '40001';
  end if;

  update public.e_invoice_documents
    set active = false, submission_eligible = false
    where id = prior.id;

  insert into public.e_invoice_documents (
    business_id, source_invoice_id, source_invoice_revision, document_type, document_version,
    scenario, canonical_document, supplier_snapshot, buyer_snapshot, supplemental_fields,
    provenance, readiness_result, status, revision, supersedes_document_id, active, submission_eligible
  ) values (
    prior.business_id, prior.source_invoice_id, prior.source_invoice_revision, prior.document_type, prior.document_version,
    prior.scenario, prior.canonical_document, prior.supplier_snapshot, prior.buyer_snapshot, prior.supplemental_fields,
    prior.provenance, prior.readiness_result,
    case when coalesce((prior.readiness_result->>'ready')::boolean, false) then 'ready' else 'needs_information' end,
    prior.revision + 1, prior.id, true, false
  ) returning * into created;
  return created;
end;
$$;

revoke all on function public.approve_e_invoice_document(uuid, uuid, integer, jsonb), public.create_e_invoice_revision(uuid, uuid) from public;
grant execute on function public.approve_e_invoice_document(uuid, uuid, integer, jsonb), public.create_e_invoice_revision(uuid, uuid) to authenticated;
