-- Keep historical v1.1/signing rows for migration compatibility, but make the
-- active application boundary unsigned MyInvois Invoice v1.0 only.

create or replace function public.assert_active_e_invoice_v1_0()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.document_version <> '1.0' then
    raise exception 'new e-invoice records must use unsigned MyInvois Invoice v1.0' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger e_invoice_documents_v1_0_only
  before insert or update of document_version on public.e_invoice_documents
  for each row execute function public.assert_active_e_invoice_v1_0();

create trigger e_invoice_payload_snapshots_v1_0_only
  before insert or update of document_version on public.e_invoice_payload_snapshots
  for each row execute function public.assert_active_e_invoice_v1_0();

comment on table public.e_invoice_signed_snapshots is
  'Deprecated historical compatibility table. NiagaAI actively supports unsigned MyInvois Invoice v1.0 only.';

drop policy if exists e_invoice_signed_snapshots_read on public.e_invoice_signed_snapshots;
drop policy if exists e_invoice_signed_snapshots_insert on public.e_invoice_signed_snapshots;
revoke all on public.e_invoice_signed_snapshots from anon, authenticated;

-- Certificate and signing-key references are retained only so upgraded
-- databases do not lose historical configuration. Active clients cannot read
-- or mutate those columns.
revoke select, insert, update on public.myinvois_connections from authenticated;
grant select (
  id, business_id, environment, auth_mode, taxpayer_tin,
  taxpayer_registration_scheme, taxpayer_registration_value, onbehalfof_value,
  credential_set_id, client_id_secret_ref, client_secret_secret_ref, enabled,
  document_version, verified_at, verified_by, sandbox_verified_at,
  sandbox_verified_by, production_activated_at, production_activated_by,
  production_disabled_at, production_disabled_by, production_activation_reason,
  created_at, updated_at
) on public.myinvois_connections to authenticated;
grant insert (
  business_id, environment, auth_mode, taxpayer_tin,
  taxpayer_registration_scheme, taxpayer_registration_value, credential_set_id,
  client_id_secret_ref, client_secret_secret_ref, enabled, document_version,
  created_at, updated_at
) on public.myinvois_connections to authenticated;
grant update (
  auth_mode, taxpayer_tin, taxpayer_registration_scheme,
  taxpayer_registration_value, credential_set_id, client_id_secret_ref,
  client_secret_secret_ref, enabled, document_version, verified_at, verified_by,
  sandbox_verified_at, sandbox_verified_by, production_activated_at,
  production_activated_by, production_disabled_at, production_disabled_by,
  production_activation_reason, updated_at
) on public.myinvois_connections to authenticated;

revoke all on function public.assert_active_e_invoice_v1_0() from public;
