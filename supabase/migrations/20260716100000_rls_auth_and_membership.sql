-- Session 3: identity lifecycle, tenant helpers, and all public-table RLS.
-- SECURITY DEFINER helpers avoid recursive policy evaluation. Keep their search
-- path fixed and expose only the explicitly granted functions below.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', '')), 120), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.is_business_member(p_business_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.business_members
    where business_id = p_business_id and user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.has_business_role(p_business_id uuid, p_roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.business_members
    where business_id = p_business_id and user_id = auth.uid()
      and status = 'active' and role = any (p_roles)
  );
$$;

create or replace function public.can_manage_business(p_business_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_business_role(p_business_id, array['owner', 'admin']);
$$;

create or replace function public.is_transaction_member(p_transaction_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_business_member(t.business_id) from public.transactions t where t.id = p_transaction_id;
$$;
create or replace function public.is_invoice_member(p_invoice_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_business_member(i.business_id) from public.invoices i where i.id = p_invoice_id;
$$;
create or replace function public.is_party_member(p_party_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_business_member(p.business_id) from public.parties p where p.id = p_party_id;
$$;
create or replace function public.is_evidence_member(p_evidence_file_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_business_member(e.business_id) from public.evidence_files e where e.id = p_evidence_file_id;
$$;
create or replace function public.is_reminder_member(p_reminder_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_business_member(r.business_id) from public.payment_reminders r where r.id = p_reminder_id;
$$;
create or replace function public.is_telegram_member(p_telegram_account_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_business_member(a.business_id) from public.telegram_accounts a where a.id = p_telegram_account_id;
$$;
create or replace function public.can_write_transaction(p_transaction_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_business_role(t.business_id, array['owner','admin','accountant','staff']) from public.transactions t where t.id = p_transaction_id;
$$;
create or replace function public.can_write_invoice(p_invoice_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_business_role(i.business_id, array['owner','admin','accountant']) from public.invoices i where i.id = p_invoice_id;
$$;
create or replace function public.can_write_party(p_party_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_business_role(p.business_id, array['owner','admin','accountant']) from public.parties p where p.id = p_party_id;
$$;
create or replace function public.can_write_evidence(p_evidence_file_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_business_role(e.business_id, array['owner','admin','accountant','staff']) from public.evidence_files e where e.id = p_evidence_file_id;
$$;
create or replace function public.can_write_reminder(p_reminder_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_business_role(r.business_id, array['owner','admin','accountant']) from public.payment_reminders r where r.id = p_reminder_id;
$$;

create or replace function public.create_business(
  p_legal_name text,
  p_trading_name text default null,
  p_entity_type text default 'other',
  p_preferred_language text default 'en',
  p_msic_code text default null,
  p_business_activity_description text default null
)
returns public.businesses
language plpgsql security definer set search_path = public as $$
declare
  created_business public.businesses;
  caller_id uuid := auth.uid();
begin
  if caller_id is null then raise exception 'authentication is required' using errcode = '42501'; end if;
  insert into public.profiles (id) values (caller_id) on conflict (id) do nothing;
  insert into public.businesses (owner_user_id, legal_name, trading_name, entity_type, preferred_language, msic_code, business_activity_description, created_by, updated_by)
  values (caller_id, p_legal_name, nullif(btrim(p_trading_name), ''), p_entity_type, p_preferred_language, nullif(btrim(p_msic_code), ''), nullif(btrim(p_business_activity_description), ''), caller_id, caller_id)
  returning * into created_business;
  insert into public.business_members (business_id, user_id, role, status, accepted_at)
  values (created_business.id, caller_id, 'owner', 'active', now());
  insert into public.business_settings (business_id) values (created_business.id);
  insert into public.audit_events (business_id, actor_user_id, action, entity_type, entity_id, after_summary, source)
  values (created_business.id, caller_id, 'business.created', 'business', created_business.id, jsonb_build_object('legal_name', created_business.legal_name), 'web');
  return created_business;
end;
$$;

create or replace function public.upsert_business_member(p_business_id uuid, p_user_id uuid, p_role text, p_status text default 'invited')
returns public.business_members
language plpgsql security definer set search_path = public as $$
declare
  caller_role text;
  result public.business_members;
begin
  select role into caller_role from public.business_members where business_id = p_business_id and user_id = auth.uid() and status = 'active';
  if caller_role not in ('owner', 'admin') then raise exception 'business management permission is required' using errcode = '42501'; end if;
  if p_role not in ('owner', 'admin', 'accountant', 'staff', 'viewer') or p_status not in ('invited', 'active', 'suspended', 'removed') then raise exception 'invalid role or status' using errcode = '22023'; end if;
  if caller_role = 'admin' and p_role in ('owner', 'admin') then raise exception 'admins cannot assign owner or admin roles' using errcode = '42501'; end if;
  if p_role = 'owner' then raise exception 'ownership changes require a restricted server operation' using errcode = '42501'; end if;
  insert into public.business_members (business_id, user_id, role, status, invited_by, invited_at, accepted_at)
  values (p_business_id, p_user_id, p_role, p_status, auth.uid(), now(), case when p_status = 'active' then now() else null end)
  on conflict (business_id, user_id) do update set role = excluded.role, status = excluded.status, accepted_at = case when excluded.status = 'active' then coalesce(public.business_members.accepted_at, now()) else public.business_members.accepted_at end
  returning * into result;
  insert into public.audit_events (business_id, actor_user_id, action, entity_type, entity_id, after_summary, source)
  values (p_business_id, auth.uid(), 'business_member.upserted', 'business_member', p_user_id, jsonb_build_object('role', p_role, 'status', p_status), 'web');
  return result;
end;
$$;

-- Cross-tenant references cannot be smuggled through a valid foreign key.
create or replace function public.assert_same_business_reference()
returns trigger language plpgsql security definer set search_path = public as $$
declare parent_business uuid; referenced_business uuid;
begin
  if tg_table_name = 'transaction_line_items' and new.product_service_id is not null then
    select t.business_id, p.business_id into parent_business, referenced_business from public.transactions t, public.products_services p where t.id = new.transaction_id and p.id = new.product_service_id;
  elsif tg_table_name = 'invoices' and new.customer_id is not null then
    parent_business := new.business_id;
    select p.business_id into referenced_business from public.parties p where p.id = new.customer_id;
  elsif tg_table_name = 'invoice_payments' and new.transaction_id is not null then
    select i.business_id, t.business_id into parent_business, referenced_business from public.invoices i, public.transactions t where i.id = new.invoice_id and t.id = new.transaction_id;
  elsif tg_table_name = 'transaction_tags' then
    select t.business_id, g.business_id into parent_business, referenced_business from public.transactions t, public.tags g where t.id = new.transaction_id and g.id = new.tag_id;
  elsif tg_table_name = 'transaction_evidence_links' then
    select t.business_id, e.business_id into parent_business, referenced_business from public.transactions t, public.evidence_files e where t.id = new.transaction_id and e.id = new.evidence_file_id;
  elsif tg_table_name = 'payment_reminders' and new.invoice_id is not null then
    parent_business := new.business_id;
    select i.business_id into referenced_business from public.invoices i where i.id = new.invoice_id;
  end if;
  if parent_business is not null and referenced_business is distinct from parent_business then raise exception 'cross-business reference is not allowed' using errcode = '23514'; end if;
  return new;
end;
$$;
create or replace function public.prevent_business_owner_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.owner_user_id is distinct from old.owner_user_id then
    raise exception 'ownership changes require a restricted server operation' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger businesses_prevent_owner_change before update on public.businesses for each row execute function public.prevent_business_owner_change();
create trigger transaction_line_items_same_business before insert or update on public.transaction_line_items for each row execute function public.assert_same_business_reference();
create trigger invoices_same_business before insert or update on public.invoices for each row execute function public.assert_same_business_reference();
create trigger invoice_payments_same_business before insert or update on public.invoice_payments for each row execute function public.assert_same_business_reference();
create trigger transaction_tags_same_business before insert or update on public.transaction_tags for each row execute function public.assert_same_business_reference();
create trigger transaction_evidence_links_same_business before insert or update on public.transaction_evidence_links for each row execute function public.assert_same_business_reference();
create trigger payment_reminders_same_business before insert or update on public.payment_reminders for each row execute function public.assert_same_business_reference();

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.business_settings enable row level security;
alter table public.business_addresses enable row level security;
alter table public.business_contacts enable row level security;
alter table public.parties enable row level security;
alter table public.party_tax_identifiers enable row level security;
alter table public.party_registration_identifiers enable row level security;
alter table public.party_addresses enable row level security;
alter table public.products_services enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_line_items enable row level security;
alter table public.transaction_status_history enable row level security;
alter table public.tags enable row level security;
alter table public.transaction_tags enable row level security;
alter table public.evidence_files enable row level security;
alter table public.extraction_runs enable row level security;
alter table public.extraction_field_results enable row level security;
alter table public.transaction_evidence_links enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.invoice_status_history enable row level security;
alter table public.invoice_payments enable row level security;
alter table public.einvoice_submissions enable row level security;
alter table public.einvoice_validation_results enable row level security;
alter table public.payment_reminders enable row level security;
alter table public.reminder_deliveries enable row level security;
alter table public.telegram_accounts enable row level security;
alter table public.telegram_conversation_states enable row level security;
alter table public.telegram_user_preferences enable row level security;
alter table public.audit_events enable row level security;
alter table public.integration_events enable row level security;
alter table public.idempotency_keys enable row level security;

create policy profiles_self on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_self_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy businesses_member_read on public.businesses for select to authenticated using (public.is_business_member(id));
create policy businesses_manage_update on public.businesses for update to authenticated using (public.can_manage_business(id)) with check (public.can_manage_business(id) and owner_user_id = (select owner_user_id from public.businesses where id = businesses.id));
create policy members_self_or_manager_read on public.business_members for select to authenticated using (user_id = auth.uid() or public.can_manage_business(business_id));
create policy settings_member_read on public.business_settings for select to authenticated using (public.is_business_member(business_id));
create policy settings_manage on public.business_settings for update to authenticated using (public.can_manage_business(business_id)) with check (public.can_manage_business(business_id));

-- Business-rooted tables share read access; writes are limited to operational roles.
create policy addresses_read on public.business_addresses for select to authenticated using (public.is_business_member(business_id));
create policy addresses_manage on public.business_addresses for all to authenticated using (public.can_manage_business(business_id)) with check (public.can_manage_business(business_id));
create policy contacts_read on public.business_contacts for select to authenticated using (public.is_business_member(business_id));
create policy contacts_manage on public.business_contacts for all to authenticated using (public.can_manage_business(business_id)) with check (public.can_manage_business(business_id));
create policy parties_read on public.parties for select to authenticated using (public.is_business_member(business_id));
create policy parties_write on public.parties for all to authenticated using (public.has_business_role(business_id, array['owner','admin','accountant'])) with check (public.has_business_role(business_id, array['owner','admin','accountant']));
create policy products_read on public.products_services for select to authenticated using (public.is_business_member(business_id));
create policy products_write on public.products_services for all to authenticated using (public.has_business_role(business_id, array['owner','admin','accountant'])) with check (public.has_business_role(business_id, array['owner','admin','accountant']));
create policy transactions_read on public.transactions for select to authenticated using (public.is_business_member(business_id));
create policy transactions_write on public.transactions for all to authenticated using (public.has_business_role(business_id, array['owner','admin','accountant','staff'])) with check (public.has_business_role(business_id, array['owner','admin','accountant','staff']));
create policy tags_read on public.tags for select to authenticated using (public.is_business_member(business_id));
create policy tags_write on public.tags for all to authenticated using (public.has_business_role(business_id, array['owner','admin','accountant','staff'])) with check (public.has_business_role(business_id, array['owner','admin','accountant','staff']));
create policy evidence_read on public.evidence_files for select to authenticated using (public.is_business_member(business_id));
create policy evidence_write on public.evidence_files for all to authenticated using (public.has_business_role(business_id, array['owner','admin','accountant','staff'])) with check (public.has_business_role(business_id, array['owner','admin','accountant','staff']));
create policy invoices_read on public.invoices for select to authenticated using (public.is_business_member(business_id));
create policy invoices_write on public.invoices for all to authenticated using (public.has_business_role(business_id, array['owner','admin','accountant'])) with check (public.has_business_role(business_id, array['owner','admin','accountant']));
create policy reminders_read on public.payment_reminders for select to authenticated using (public.is_business_member(business_id));
create policy reminders_write on public.payment_reminders for all to authenticated using (public.has_business_role(business_id, array['owner','admin','accountant'])) with check (public.has_business_role(business_id, array['owner','admin','accountant']));

-- Child tables inherit access from their parent through security-definer helpers.
create policy party_tax_read on public.party_tax_identifiers for select to authenticated using (public.is_party_member(party_id));
create policy party_tax_write on public.party_tax_identifiers for all to authenticated using (public.can_write_party(party_id)) with check (public.can_write_party(party_id));
create policy party_registration_read on public.party_registration_identifiers for select to authenticated using (public.is_party_member(party_id));
create policy party_registration_write on public.party_registration_identifiers for all to authenticated using (public.can_write_party(party_id)) with check (public.can_write_party(party_id));
create policy party_addresses_read on public.party_addresses for select to authenticated using (public.is_party_member(party_id));
create policy party_addresses_write on public.party_addresses for all to authenticated using (public.can_write_party(party_id)) with check (public.can_write_party(party_id));
create policy transaction_lines_read on public.transaction_line_items for select to authenticated using (public.is_transaction_member(transaction_id));
create policy transaction_lines_write on public.transaction_line_items for all to authenticated using (public.can_write_transaction(transaction_id)) with check (public.can_write_transaction(transaction_id));
create policy transaction_history_read on public.transaction_status_history for select to authenticated using (public.is_transaction_member(transaction_id));
create policy transaction_tags_read on public.transaction_tags for select to authenticated using (public.is_transaction_member(transaction_id));
create policy transaction_tags_write on public.transaction_tags for all to authenticated using (public.can_write_transaction(transaction_id)) with check (public.can_write_transaction(transaction_id));
create policy extraction_runs_read on public.extraction_runs for select to authenticated using (public.is_evidence_member(evidence_file_id));
create policy extraction_fields_read on public.extraction_field_results for select to authenticated using (exists (select 1 from public.extraction_runs r where r.id = extraction_run_id and public.is_evidence_member(r.evidence_file_id)));
create policy transaction_evidence_read on public.transaction_evidence_links for select to authenticated using (public.is_transaction_member(transaction_id));
create policy transaction_evidence_write on public.transaction_evidence_links for all to authenticated using (public.can_write_transaction(transaction_id)) with check (public.can_write_transaction(transaction_id));
create policy invoice_items_read on public.invoice_items for select to authenticated using (public.is_invoice_member(invoice_id));
create policy invoice_items_write on public.invoice_items for all to authenticated using (public.can_write_invoice(invoice_id)) with check (public.can_write_invoice(invoice_id));
create policy invoice_history_read on public.invoice_status_history for select to authenticated using (public.is_invoice_member(invoice_id));
create policy invoice_payments_read on public.invoice_payments for select to authenticated using (public.is_invoice_member(invoice_id));
create policy invoice_payments_write on public.invoice_payments for all to authenticated using (public.can_write_invoice(invoice_id)) with check (public.can_write_invoice(invoice_id));
create policy reminder_deliveries_read on public.reminder_deliveries for select to authenticated using (public.is_reminder_member(reminder_id));
create policy telegram_accounts_read on public.telegram_accounts for select to authenticated using (public.is_business_member(business_id));
create policy telegram_states_read on public.telegram_conversation_states for select to authenticated using (public.is_telegram_member(telegram_account_id));
create policy telegram_preferences_read on public.telegram_user_preferences for select to authenticated using (public.is_telegram_member(telegram_account_id));
create policy audit_read on public.audit_events for select to authenticated using (business_id is not null and public.has_business_role(business_id, array['owner','admin','accountant']));
create policy integration_read on public.integration_events for select to authenticated using (public.has_business_role(business_id, array['owner','admin']));
create policy idempotency_read on public.idempotency_keys for select to authenticated using (public.has_business_role(business_id, array['owner','admin','accountant']));
create policy einvoice_submissions_read on public.einvoice_submissions for select to authenticated using (public.is_invoice_member(invoice_id));
create policy einvoice_validation_read on public.einvoice_validation_results for select to authenticated using (public.is_invoice_member(invoice_id));

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on public.profiles, public.businesses, public.business_settings, public.business_addresses, public.business_contacts, public.parties, public.party_tax_identifiers, public.party_registration_identifiers, public.party_addresses, public.products_services, public.transactions, public.transaction_line_items, public.tags, public.transaction_tags, public.evidence_files, public.transaction_evidence_links, public.invoices, public.invoice_items, public.invoice_payments, public.payment_reminders to authenticated;
grant select on public.business_members, public.transaction_status_history, public.extraction_runs, public.extraction_field_results, public.invoice_status_history, public.reminder_deliveries, public.telegram_accounts, public.telegram_conversation_states, public.telegram_user_preferences, public.audit_events, public.integration_events, public.idempotency_keys, public.einvoice_submissions, public.einvoice_validation_results to authenticated;
revoke all on function public.handle_new_auth_user(), public.is_business_member(uuid), public.has_business_role(uuid, text[]), public.can_manage_business(uuid), public.is_transaction_member(uuid), public.is_invoice_member(uuid), public.is_party_member(uuid), public.is_evidence_member(uuid), public.is_reminder_member(uuid), public.is_telegram_member(uuid), public.can_write_transaction(uuid), public.can_write_invoice(uuid), public.can_write_party(uuid), public.can_write_evidence(uuid), public.can_write_reminder(uuid), public.assert_same_business_reference(), public.prevent_business_owner_change() from public;
revoke all on function public.create_business(text, text, text, text, text, text), public.upsert_business_member(uuid, uuid, text, text) from public;
grant execute on function public.is_business_member(uuid), public.has_business_role(uuid, text[]), public.can_manage_business(uuid), public.is_transaction_member(uuid), public.is_invoice_member(uuid), public.is_party_member(uuid), public.is_evidence_member(uuid), public.is_reminder_member(uuid), public.is_telegram_member(uuid), public.can_write_transaction(uuid), public.can_write_invoice(uuid), public.can_write_party(uuid), public.can_write_evidence(uuid), public.can_write_reminder(uuid), public.create_business(text, text, text, text, text, text), public.upsert_business_member(uuid, uuid, text, text) to authenticated;
