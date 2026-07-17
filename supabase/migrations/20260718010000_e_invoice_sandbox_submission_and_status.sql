-- Stage 5: immutable sandbox submission history and server-owned status reconciliation.

create table public.e_invoice_submissions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  environment text not null check (environment in ('sandbox', 'production')),
  idempotency_key text not null check (idempotency_key ~ '^[0-9a-f]{64}$'),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  submission_uid text,
  status text not null check (status in ('pending', 'submitted', 'processing', 'completed', 'failed')),
  requested_at timestamptz not null,
  responded_at timestamptz,
  http_status integer check (http_status between 100 and 599),
  correlation_id text,
  retry_count integer not null default 0 check (retry_count >= 0),
  retry_after timestamptz,
  error_code text,
  error_message text,
  raw_response jsonb,
  created_at timestamptz not null default now(),
  unique (business_id, idempotency_key),
  unique (business_id, submission_uid)
);

create index e_invoice_submissions_due
  on public.e_invoice_submissions (retry_after)
  where status in ('submitted', 'processing');

create table public.e_invoice_submission_documents (
  submission_id uuid not null references public.e_invoice_submissions(id) on delete restrict,
  e_invoice_document_id uuid not null references public.e_invoice_documents(id) on delete restrict,
  payload_snapshot_id uuid not null references public.e_invoice_payload_snapshots(id) on delete restrict,
  invoice_code_number text not null,
  accepted boolean,
  status text not null check (status in ('submitted', 'processing', 'valid', 'invalid', 'cancelled', 'failed')),
  myinvois_uuid text,
  long_id text,
  share_url text,
  rejection_error jsonb,
  validation_result jsonb,
  cancellation_eligible_until timestamptz,
  created_at timestamptz not null default now(),
  primary key (submission_id, e_invoice_document_id),
  unique (submission_id, invoice_code_number),
  unique (submission_id, payload_snapshot_id)
);

create table public.e_invoice_status_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  e_invoice_document_id uuid not null references public.e_invoice_documents(id) on delete restrict,
  submission_id uuid not null references public.e_invoice_submissions(id) on delete restrict,
  status text not null check (status in ('submitted', 'processing', 'valid', 'invalid', 'cancelled', 'failed')),
  source text not null check (source in ('submission_response', 'poll', 'manual_refresh')),
  occurred_at timestamptz not null,
  details jsonb not null default '{}'::jsonb,
  validation_result jsonb,
  created_at timestamptz not null default now()
);

create index e_invoice_status_events_document_time
  on public.e_invoice_status_events (business_id, e_invoice_document_id, occurred_at desc);

alter table public.e_invoice_submissions enable row level security;
alter table public.e_invoice_submission_documents enable row level security;
alter table public.e_invoice_status_events enable row level security;

create policy e_invoice_submissions_read on public.e_invoice_submissions
  for select to authenticated using (public.is_business_member(business_id));
create policy e_invoice_submission_documents_read on public.e_invoice_submission_documents
  for select to authenticated using (exists (
    select 1 from public.e_invoice_submissions s
    where s.id = submission_id and public.is_business_member(s.business_id)
  ));
create policy e_invoice_status_events_read on public.e_invoice_status_events
  for select to authenticated using (public.is_business_member(business_id));

revoke all on public.e_invoice_submissions, public.e_invoice_submission_documents, public.e_invoice_status_events from anon;
revoke insert, update, delete, truncate on public.e_invoice_submissions, public.e_invoice_submission_documents, public.e_invoice_status_events from authenticated;
grant select on public.e_invoice_submissions, public.e_invoice_submission_documents, public.e_invoice_status_events to authenticated;

create function public.create_e_invoice_pending_submission(
  p_business_id uuid,
  p_environment text,
  p_idempotency_key text,
  p_request_hash text,
  p_requested_at timestamptz,
  p_documents jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare result_id uuid;
declare item jsonb;
declare inserted boolean := false;
begin
  if not (auth.role() = 'service_role' or public.has_business_role(p_business_id, array['owner','admin','accountant'])) then
    raise exception 'not authorised to submit e-Invoices' using errcode = '42501';
  end if;
  insert into public.e_invoice_submissions (
    business_id, environment, idempotency_key, request_hash, status, requested_at
  ) values (
    p_business_id, p_environment, p_idempotency_key, p_request_hash, 'pending', p_requested_at
  ) on conflict (business_id, idempotency_key) do nothing returning id into result_id;
  inserted := result_id is not null;
  if not inserted then
    select id into result_id from public.e_invoice_submissions
      where business_id = p_business_id and idempotency_key = p_idempotency_key;
    return jsonb_build_object('id', result_id, 'created', false);
  end if;
  for item in select value from jsonb_array_elements(p_documents) loop
    if not exists (
      select 1 from public.e_invoice_payload_snapshots payload
      join public.e_invoice_documents document on document.id = payload.e_invoice_document_id
      where payload.id = (item->>'payloadSnapshotId')::uuid
        and payload.business_id = p_business_id and payload.document_version = '1.0'
        and document.id = (item->>'eInvoiceDocumentId')::uuid
        and document.status = 'approved' and document.active and document.submission_eligible
        and document.revision = payload.document_revision
    ) then
      raise exception 'submission document is not an active unsigned v1.0 approved revision' using errcode = '23514';
    end if;
    insert into public.e_invoice_submission_documents (
      submission_id, e_invoice_document_id, payload_snapshot_id, invoice_code_number, status
    ) values (
      result_id, (item->>'eInvoiceDocumentId')::uuid, (item->>'payloadSnapshotId')::uuid,
      item->>'invoiceCodeNumber', 'submitted'
    );
  end loop;
  return jsonb_build_object('id', result_id, 'created', true);
end;
$$;

create function public.record_e_invoice_submission_response(
  p_business_id uuid,
  p_submission_id uuid,
  p_response jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare item jsonb;
declare document_row public.e_invoice_submission_documents;
begin
  if not (auth.role() = 'service_role' or public.has_business_role(p_business_id, array['owner','admin','accountant'])) then
    raise exception 'not authorised to record e-Invoice submission' using errcode = '42501';
  end if;
  update public.e_invoice_submissions set
    status = p_response->>'status', responded_at = (p_response->>'respondedAt')::timestamptz,
    http_status = nullif(p_response->>'httpStatus','')::integer,
    correlation_id = p_response->>'correlationId', submission_uid = p_response->>'submissionUid',
    retry_after = nullif(p_response->>'retryAfter','')::timestamptz,
    error_code = p_response->>'errorCode', error_message = p_response->>'errorMessage',
    raw_response = p_response->'rawResponse', retry_count = (p_response->>'retryCount')::integer
  where id = p_submission_id and business_id = p_business_id and status = 'pending';
  if not found then raise exception 'pending submission not found' using errcode = 'P0002'; end if;
  for item in select value from jsonb_array_elements(p_response->'documents') loop
    update public.e_invoice_submission_documents set
      accepted = nullif(item->>'accepted','')::boolean,
      status = item->>'status', myinvois_uuid = item->>'myinvoisUuid',
      rejection_error = item->'rejectionError'
    where submission_id = p_submission_id and invoice_code_number = item->>'invoiceCodeNumber'
    returning * into document_row;
    insert into public.e_invoice_status_events (
      business_id, e_invoice_document_id, submission_id, status, source, occurred_at, details
    ) values (
      p_business_id, document_row.e_invoice_document_id, p_submission_id, document_row.status,
      'submission_response', (p_response->>'respondedAt')::timestamptz,
      jsonb_strip_nulls(jsonb_build_object('accepted', document_row.accepted, 'myinvoisUuid', document_row.myinvois_uuid, 'rejectionError', document_row.rejection_error))
    );
  end loop;
end;
$$;

create function public.reconcile_e_invoice_submission(
  p_business_id uuid,
  p_submission_id uuid,
  p_reconciliation jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare item jsonb;
declare document_row public.e_invoice_submission_documents;
declare old_status text;
begin
  if not (auth.role() = 'service_role' or public.has_business_role(p_business_id, array['owner','admin','accountant'])) then
    raise exception 'not authorised to refresh e-Invoice submission' using errcode = '42501';
  end if;
  update public.e_invoice_submissions set
    status = p_reconciliation->>'status',
    retry_after = nullif(p_reconciliation->>'retryAfter','')::timestamptz,
    retry_count = retry_count + 1
  where id = p_submission_id and business_id = p_business_id and status in ('submitted','processing');
  if not found then raise exception 'active submission not found' using errcode = 'P0002'; end if;
  for item in select value from jsonb_array_elements(p_reconciliation->'documents') loop
    select status into old_status from public.e_invoice_submission_documents
      where submission_id = p_submission_id and invoice_code_number = item->>'invoiceCodeNumber';
    update public.e_invoice_submission_documents set
      status = item->>'status', myinvois_uuid = coalesce(item->>'myinvoisUuid', myinvois_uuid),
      long_id = coalesce(item->>'longId', long_id), share_url = coalesce(item->>'shareUrl', share_url),
      validation_result = coalesce(item->'validationResult', validation_result),
      cancellation_eligible_until = coalesce(nullif(item->>'cancellationEligibleUntil','')::timestamptz, cancellation_eligible_until)
    where submission_id = p_submission_id and invoice_code_number = item->>'invoiceCodeNumber'
    returning * into document_row;
    if old_status is distinct from document_row.status or item ? 'validationResult' then
      insert into public.e_invoice_status_events (
        business_id, e_invoice_document_id, submission_id, status, source, occurred_at, details, validation_result
      ) values (
        p_business_id, document_row.e_invoice_document_id, p_submission_id, document_row.status,
        coalesce(p_reconciliation->>'source','poll'), (p_reconciliation->>'checkedAt')::timestamptz,
        jsonb_strip_nulls(jsonb_build_object('myinvoisUuid', document_row.myinvois_uuid, 'longId', document_row.long_id, 'shareUrl', document_row.share_url)),
        document_row.validation_result
      );
    end if;
  end loop;
end;
$$;

revoke all on function public.create_e_invoice_pending_submission(uuid,text,text,text,timestamptz,jsonb) from public;
revoke all on function public.record_e_invoice_submission_response(uuid,uuid,jsonb) from public;
revoke all on function public.reconcile_e_invoice_submission(uuid,uuid,jsonb) from public;
grant execute on function public.create_e_invoice_pending_submission(uuid,text,text,text,timestamptz,jsonb) to authenticated, service_role;
grant execute on function public.record_e_invoice_submission_response(uuid,uuid,jsonb) to authenticated, service_role;
grant execute on function public.reconcile_e_invoice_submission(uuid,uuid,jsonb) to authenticated, service_role;
