-- Stage 6: production activation, durable worker leases, cancellation audit, and operator recovery.
-- NiagaAI intentionally submits unsigned MyInvois document version 1.0. Certificate-backed
-- v1.1 signing is not a production prerequisite while HASiL continues to support v1.0.

alter table public.myinvois_connections
  add column document_version text not null default '1.0' check (document_version = '1.0'),
  add column sandbox_verified_at timestamptz,
  add column sandbox_verified_by uuid references public.profiles(id) on delete set null,
  add column production_activated_at timestamptz,
  add column production_activated_by uuid references public.profiles(id) on delete set null,
  add column production_disabled_at timestamptz,
  add column production_disabled_by uuid references public.profiles(id) on delete set null,
  add column production_activation_reason text,
  add constraint myinvois_production_activation_environment check (
    environment = 'production' or production_activated_at is null
  );

alter table public.e_invoice_submissions
  add column lease_owner text,
  add column lease_expires_at timestamptz,
  add column last_attempt_at timestamptz,
  add column worker_failure_count integer not null default 0 check (worker_failure_count >= 0),
  add column dead_lettered_at timestamptz,
  add column dead_letter_reason text;

alter table public.e_invoice_submissions drop constraint e_invoice_submissions_status_check;
alter table public.e_invoice_submissions add constraint e_invoice_submissions_status_check
  check (status in ('pending', 'submitted', 'processing', 'completed', 'failed', 'dead_letter'));

create index e_invoice_submissions_lease_due
  on public.e_invoice_submissions (retry_after, lease_expires_at)
  where status in ('submitted', 'processing');

create table public.e_invoice_rate_limit_buckets (
  credential_set_id text not null,
  environment text not null check (environment in ('sandbox', 'production')),
  endpoint text not null check (endpoint in ('submit', 'get_submission', 'get_document_details', 'cancel')),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (credential_set_id, environment, endpoint, window_started_at)
);
revoke all on public.e_invoice_rate_limit_buckets from anon, authenticated;

alter table public.e_invoice_status_events drop constraint e_invoice_status_events_source_check;
alter table public.e_invoice_status_events add constraint e_invoice_status_events_source_check
  check (source in ('submission_response', 'poll', 'manual_refresh', 'cancellation', 'operator_recovery'));

create table public.e_invoice_operation_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  environment text not null check (environment in ('sandbox', 'production')),
  action text not null check (action in (
    'sandbox_verified', 'production_activated', 'production_disabled',
    'document_cancelled', 'worker_dead_lettered', 'worker_requeued'
  )),
  actor_id uuid references public.profiles(id) on delete set null,
  target_type text not null,
  target_id text not null,
  reason text,
  outcome text not null check (outcome in ('succeeded', 'failed')),
  correlation_id text,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create table public.e_invoice_cancellation_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  submission_id uuid not null references public.e_invoice_submissions(id) on delete restrict,
  e_invoice_document_id uuid not null references public.e_invoice_documents(id) on delete restrict,
  reason text not null check (char_length(reason) between 10 and 300),
  status text not null check (status in ('pending', 'succeeded', 'failed')),
  requested_by uuid not null references public.profiles(id) on delete restrict,
  requested_at timestamptz not null,
  completed_at timestamptz,
  error_summary text,
  unique (submission_id, e_invoice_document_id)
);
alter table public.e_invoice_cancellation_requests enable row level security;
create policy e_invoice_cancellation_requests_read on public.e_invoice_cancellation_requests
  for select to authenticated using (public.has_business_role(business_id, array['owner','admin','accountant']));
revoke all on public.e_invoice_cancellation_requests from anon;
revoke insert, update, delete, truncate on public.e_invoice_cancellation_requests from authenticated;
grant select on public.e_invoice_cancellation_requests to authenticated;

create index e_invoice_operation_events_business_time
  on public.e_invoice_operation_events (business_id, occurred_at desc);

alter table public.e_invoice_operation_events enable row level security;
create policy e_invoice_operation_events_read on public.e_invoice_operation_events
  for select to authenticated using (public.has_business_role(business_id, array['owner','admin','accountant']));
revoke all on public.e_invoice_operation_events from anon;
revoke insert, update, delete, truncate on public.e_invoice_operation_events from authenticated;
grant select on public.e_invoice_operation_events to authenticated;

-- Raw provider responses stay server-restricted; ordinary users receive the redacted columns.
revoke select on public.e_invoice_submissions from authenticated;
grant select (
  id, business_id, environment, idempotency_key, request_hash, submission_uid, status,
  requested_at, responded_at, http_status, correlation_id, retry_count, retry_after,
  error_code, error_message, created_at, lease_owner, lease_expires_at, last_attempt_at,
  worker_failure_count, dead_lettered_at, dead_letter_reason
) on public.e_invoice_submissions to authenticated;

-- Activation and verification fields may only change through the audited security-definer functions.
revoke update on public.myinvois_connections from authenticated;
grant update (
  auth_mode, taxpayer_tin, taxpayer_registration_scheme, taxpayer_registration_value,
  credential_set_id, client_id_secret_ref, client_secret_secret_ref,
  signing_certificate_secret_ref, signing_private_key_secret_ref,
  signing_key_passphrase_secret_ref, signing_certificate_chain_secret_ref,
  enabled, verified_at, verified_by, certificate_thumbprint, certificate_subject,
  certificate_issuer, certificate_serial_number, certificate_not_before, certificate_not_after
) on public.myinvois_connections to authenticated;

create function public.set_e_invoice_production_activation(
  p_business_id uuid,
  p_enabled boolean,
  p_reason text
) returns void language plpgsql security definer set search_path = public as $$
declare actor uuid := auth.uid();
declare production_connection public.myinvois_connections;
declare sandbox_connection public.myinvois_connections;
begin
  if actor is null or not public.has_business_role(p_business_id, array['owner','admin']) then
    raise exception 'only an owner or admin can change production activation' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 10 and 300 then
    raise exception 'an operational reason between 10 and 300 characters is required' using errcode = '23514';
  end if;
  select * into production_connection from public.myinvois_connections
    where business_id = p_business_id and environment = 'production' for update;
  if production_connection.id is null then
    raise exception 'production connection is not configured' using errcode = 'P0002';
  end if;
  if p_enabled then
    select * into sandbox_connection from public.myinvois_connections
      where business_id = p_business_id and environment = 'sandbox';
    if not production_connection.enabled or production_connection.verified_at is null
      or production_connection.document_version <> '1.0'
      or sandbox_connection.sandbox_verified_at is null then
      raise exception 'production activation prerequisites are incomplete' using errcode = '23514';
    end if;
    update public.myinvois_connections set
      production_activated_at = now(), production_activated_by = actor,
      production_disabled_at = null, production_disabled_by = null,
      production_activation_reason = btrim(p_reason)
    where id = production_connection.id;
  else
    update public.myinvois_connections set
      production_disabled_at = now(), production_disabled_by = actor,
      production_activation_reason = btrim(p_reason)
    where id = production_connection.id;
  end if;
  insert into public.e_invoice_operation_events (
    business_id, environment, action, actor_id, target_type, target_id, reason, outcome
  ) values (
    p_business_id, 'production', case when p_enabled then 'production_activated' else 'production_disabled' end,
    actor, 'myinvois_connection', production_connection.id::text, btrim(p_reason), 'succeeded'
  );
end;
$$;

create function public.mark_e_invoice_sandbox_verified(p_business_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare actor uuid := auth.uid();
declare connection_id uuid;
begin
  if actor is null or not public.has_business_role(p_business_id, array['owner','admin']) then
    raise exception 'only an owner or admin can verify the sandbox checklist' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 10 and 300 then
    raise exception 'a verification note between 10 and 300 characters is required' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.e_invoice_submissions s
    join public.e_invoice_submission_documents d on d.submission_id = s.id
    where s.business_id = p_business_id and s.environment = 'sandbox'
      and d.status in ('valid', 'invalid')
  ) then
    raise exception 'a reconciled sandbox document is required' using errcode = '23514';
  end if;
  update public.myinvois_connections set sandbox_verified_at = now(), sandbox_verified_by = actor
    where business_id = p_business_id and environment = 'sandbox' and enabled
    returning id into connection_id;
  if connection_id is null then raise exception 'enabled sandbox connection not found' using errcode = 'P0002'; end if;
  insert into public.e_invoice_operation_events (
    business_id, environment, action, actor_id, target_type, target_id, reason, outcome
  ) values (p_business_id, 'sandbox', 'sandbox_verified', actor, 'myinvois_connection', connection_id::text, btrim(p_reason), 'succeeded');
end;
$$;

create function public.claim_due_e_invoice_submissions(
  p_worker_id text,
  p_limit integer,
  p_at timestamptz,
  p_lease_seconds integer default 60
) returns setof public.e_invoice_submissions language plpgsql security definer set search_path = public as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service role required' using errcode = '42501'; end if;
  return query
  with due as (
    select id from public.e_invoice_submissions
    where status in ('submitted','processing') and retry_after <= p_at
      and (lease_expires_at is null or lease_expires_at <= p_at)
    order by retry_after for update skip locked limit least(greatest(p_limit, 1), 100)
  )
  update public.e_invoice_submissions s set
    lease_owner = left(p_worker_id, 100), lease_expires_at = p_at + make_interval(secs => least(greatest(p_lease_seconds, 15), 300)),
    last_attempt_at = p_at
  from due where s.id = due.id returning s.*;
end;
$$;

create function public.reserve_e_invoice_provider_call(
  p_business_id uuid, p_credential_set_id text, p_environment text,
  p_endpoint text, p_limit integer, p_at timestamptz
) returns boolean language plpgsql security definer set search_path = public as $$
declare bucket timestamptz := date_trunc('minute', p_at);
declare current_count integer;
begin
  if not (auth.role() = 'service_role' or public.has_business_role(p_business_id, array['owner','admin'])) then
    raise exception 'not authorised to call MyInvois' using errcode = '42501';
  end if;
  if p_endpoint not in ('submit', 'get_submission', 'get_document_details', 'cancel')
    or p_environment not in ('sandbox', 'production') or p_limit < 1 then
    raise exception 'invalid provider rate-limit request' using errcode = '23514';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_credential_set_id || ':' || p_environment || ':' || p_endpoint || ':' || bucket::text, 0));
  select request_count into current_count from public.e_invoice_rate_limit_buckets
    where credential_set_id = p_credential_set_id and environment = p_environment
      and endpoint = p_endpoint and window_started_at = bucket;
  if coalesce(current_count, 0) >= p_limit then return false; end if;
  insert into public.e_invoice_rate_limit_buckets (credential_set_id, environment, endpoint, window_started_at, request_count)
    values (p_credential_set_id, p_environment, p_endpoint, bucket, 1)
    on conflict (credential_set_id, environment, endpoint, window_started_at)
    do update set request_count = public.e_invoice_rate_limit_buckets.request_count + 1;
  delete from public.e_invoice_rate_limit_buckets where window_started_at < bucket - interval '10 minutes';
  return true;
end;
$$;

create function public.record_e_invoice_worker_failure(
  p_business_id uuid, p_submission_id uuid, p_worker_id text, p_reason text, p_at timestamptz
) returns void language plpgsql security definer set search_path = public as $$
declare retries integer;
declare terminal boolean;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required' using errcode = '42501'; end if;
  update public.e_invoice_submissions set
    worker_failure_count = worker_failure_count + 1,
    status = case when worker_failure_count + 1 >= 12 then 'dead_letter' else status end,
    retry_after = case when worker_failure_count + 1 >= 12 then null else p_at + make_interval(secs => least(1800, 5 * (2 ^ least(worker_failure_count, 8))::integer)) end,
    lease_owner = null, lease_expires_at = null,
    dead_lettered_at = case when retry_count + 1 >= 12 then p_at else dead_lettered_at end,
    dead_letter_reason = left(p_reason, 500)
  where id = p_submission_id and business_id = p_business_id and lease_owner = left(p_worker_id, 100)
  returning worker_failure_count, status = 'dead_letter' into retries, terminal;
  if not found then raise exception 'leased submission not found' using errcode = 'P0002'; end if;
  if terminal then
    insert into public.e_invoice_operation_events (
      business_id, environment, action, target_type, target_id, reason, outcome, details
    ) select p_business_id, environment, 'worker_dead_lettered', 'e_invoice_submission', id::text,
      left(p_reason, 500), 'failed', jsonb_build_object('retryCount', retries)
      from public.e_invoice_submissions where id = p_submission_id;
  end if;
end;
$$;

create function public.record_e_invoice_worker_success(
  p_business_id uuid, p_submission_id uuid, p_worker_id text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service role required' using errcode = '42501'; end if;
  update public.e_invoice_submissions set
    worker_failure_count = 0, lease_owner = null, lease_expires_at = null
  where id = p_submission_id and business_id = p_business_id and lease_owner = left(p_worker_id, 100);
  if not found then raise exception 'leased submission not found' using errcode = 'P0002'; end if;
end;
$$;

create function public.record_e_invoice_cancellation(
  p_business_id uuid, p_submission_id uuid, p_document_id uuid,
  p_reason text, p_cancelled_at timestamptz, p_correlation_id text, p_raw_response jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare actor uuid := auth.uid();
declare target public.e_invoice_submission_documents;
declare environment_value text;
begin
  if actor is null or not public.has_business_role(p_business_id, array['owner','admin']) then
    raise exception 'only an owner or admin can cancel e-Invoices' using errcode = '42501';
  end if;
  select d.* into target
    from public.e_invoice_submission_documents d join public.e_invoice_submissions s on s.id = d.submission_id
    where d.submission_id = p_submission_id and d.e_invoice_document_id = p_document_id
      and s.business_id = p_business_id for update;
  select s.environment into environment_value from public.e_invoice_submissions s
    where s.id = p_submission_id and s.business_id = p_business_id;
  if target.status <> 'valid' or target.myinvois_uuid is null
    or target.cancellation_eligible_until is null or p_cancelled_at > target.cancellation_eligible_until then
    raise exception 'document is not eligible for cancellation' using errcode = '23514';
  end if;
  update public.e_invoice_submission_documents set status = 'cancelled'
    where submission_id = p_submission_id and e_invoice_document_id = p_document_id;
  insert into public.e_invoice_status_events (
    business_id, e_invoice_document_id, submission_id, status, source, occurred_at, details
  ) values (p_business_id, p_document_id, p_submission_id, 'cancelled', 'cancellation', p_cancelled_at,
    jsonb_build_object('reason', btrim(p_reason), 'correlationId', p_correlation_id));
  insert into public.e_invoice_operation_events (
    business_id, environment, action, actor_id, target_type, target_id, reason, outcome, correlation_id, details
  ) values (p_business_id, environment_value, 'document_cancelled', actor, 'e_invoice_document', p_document_id::text,
    btrim(p_reason), 'succeeded', p_correlation_id, jsonb_build_object('submissionId', p_submission_id));
  update public.e_invoice_cancellation_requests set status = 'succeeded', completed_at = p_cancelled_at, error_summary = null
    where business_id = p_business_id and submission_id = p_submission_id
      and e_invoice_document_id = p_document_id and status = 'pending';
end;
$$;

create function public.claim_e_invoice_cancellation(
  p_business_id uuid, p_submission_id uuid, p_document_id uuid, p_reason text, p_requested_at timestamptz
) returns boolean language plpgsql security definer set search_path = public as $$
declare actor uuid := auth.uid();
declare claimed uuid;
begin
  if actor is null or not public.has_business_role(p_business_id, array['owner','admin']) then
    raise exception 'only an owner or admin can cancel e-Invoices' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.e_invoice_submission_documents d join public.e_invoice_submissions s on s.id = d.submission_id
    where d.submission_id = p_submission_id and d.e_invoice_document_id = p_document_id
      and s.business_id = p_business_id and d.status = 'valid' and d.myinvois_uuid is not null
      and d.cancellation_eligible_until >= p_requested_at
  ) then raise exception 'document is not eligible for cancellation' using errcode = '23514'; end if;
  insert into public.e_invoice_cancellation_requests (
    business_id, submission_id, e_invoice_document_id, reason, status, requested_by, requested_at
  ) values (p_business_id, p_submission_id, p_document_id, btrim(p_reason), 'pending', actor, p_requested_at)
  on conflict (submission_id, e_invoice_document_id) do update set
    reason = excluded.reason, status = 'pending', requested_by = excluded.requested_by,
    requested_at = excluded.requested_at, completed_at = null, error_summary = null
    where public.e_invoice_cancellation_requests.status = 'failed'
  returning id into claimed;
  return claimed is not null;
end;
$$;

create function public.fail_e_invoice_cancellation(
  p_business_id uuid, p_submission_id uuid, p_document_id uuid, p_reason text, p_failed_at timestamptz
) returns void language plpgsql security definer set search_path = public as $$
declare actor uuid := auth.uid();
declare environment_value text;
begin
  if actor is null or not public.has_business_role(p_business_id, array['owner','admin']) then
    raise exception 'only an owner or admin can record cancellation failure' using errcode = '42501';
  end if;
  update public.e_invoice_cancellation_requests set status = 'failed', completed_at = p_failed_at, error_summary = left(p_reason, 500)
    where business_id = p_business_id and submission_id = p_submission_id
      and e_invoice_document_id = p_document_id and status = 'pending';
  select environment into environment_value from public.e_invoice_submissions where id = p_submission_id and business_id = p_business_id;
  insert into public.e_invoice_operation_events (
    business_id, environment, action, actor_id, target_type, target_id, reason, outcome, details
  ) values (p_business_id, environment_value, 'document_cancelled', actor, 'e_invoice_document', p_document_id::text,
    left(p_reason, 500), 'failed', jsonb_build_object('submissionId', p_submission_id));
end;
$$;

revoke all on function public.set_e_invoice_production_activation(uuid,boolean,text) from public;
revoke all on function public.mark_e_invoice_sandbox_verified(uuid,text) from public;
revoke all on function public.claim_due_e_invoice_submissions(text,integer,timestamptz,integer) from public;
revoke all on function public.reserve_e_invoice_provider_call(uuid,text,text,text,integer,timestamptz) from public;
revoke all on function public.record_e_invoice_worker_failure(uuid,uuid,text,text,timestamptz) from public;
revoke all on function public.record_e_invoice_worker_success(uuid,uuid,text) from public;
revoke all on function public.record_e_invoice_cancellation(uuid,uuid,uuid,text,timestamptz,text,jsonb) from public;
revoke all on function public.claim_e_invoice_cancellation(uuid,uuid,uuid,text,timestamptz) from public;
revoke all on function public.fail_e_invoice_cancellation(uuid,uuid,uuid,text,timestamptz) from public;
grant execute on function public.set_e_invoice_production_activation(uuid,boolean,text) to authenticated;
grant execute on function public.mark_e_invoice_sandbox_verified(uuid,text) to authenticated;
grant execute on function public.claim_due_e_invoice_submissions(text,integer,timestamptz,integer) to service_role;
grant execute on function public.reserve_e_invoice_provider_call(uuid,text,text,text,integer,timestamptz) to authenticated, service_role;
grant execute on function public.record_e_invoice_worker_failure(uuid,uuid,text,text,timestamptz) to service_role;
grant execute on function public.record_e_invoice_worker_success(uuid,uuid,text) to service_role;
grant execute on function public.record_e_invoice_cancellation(uuid,uuid,uuid,text,timestamptz,text,jsonb) to authenticated;
grant execute on function public.claim_e_invoice_cancellation(uuid,uuid,uuid,text,timestamptz) to authenticated;
grant execute on function public.fail_e_invoice_cancellation(uuid,uuid,uuid,text,timestamptz) to authenticated;
