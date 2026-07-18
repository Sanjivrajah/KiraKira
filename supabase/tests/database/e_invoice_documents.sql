begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(13);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at) values
  ('61111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'einvoice-a@example.test', 'x', now(), now(), now()),
  ('62222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'einvoice-b@example.test', 'x', now(), now(), now()),
  ('63333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'einvoice-viewer@example.test', 'x', now(), now(), now());
insert into public.profiles (id) values
  ('61111111-1111-4111-8111-111111111111'),
  ('62222222-2222-4222-8222-222222222222'),
  ('63333333-3333-4333-8333-333333333333') on conflict do nothing;
insert into public.businesses (id, owner_user_id, legal_name, entity_type) values
  ('6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '61111111-1111-4111-8111-111111111111', 'E-Invoice A', 'other'),
  ('6bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '62222222-2222-4222-8222-222222222222', 'E-Invoice B', 'other');
insert into public.business_members (business_id, user_id, role, status, accepted_at) values
  ('6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '61111111-1111-4111-8111-111111111111', 'owner', 'active', now()),
  ('6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '63333333-3333-4333-8333-333333333333', 'viewer', 'active', now()),
  ('6bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '62222222-2222-4222-8222-222222222222', 'owner', 'active', now());
insert into public.invoices (id, business_id, invoice_number, issue_date, currency, status, subtotal_minor, total_minor) values
  ('6a111111-1111-4111-8111-111111111111', '6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'A-001', current_date, 'MYR', 'draft', 10000, 10000),
  ('6b222222-2222-4222-8222-222222222222', '6bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'B-001', current_date, 'MYR', 'draft', 10000, 10000);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '61111111-1111-4111-8111-111111111111', true);
insert into public.e_invoice_documents (id, business_id, source_invoice_id, source_invoice_revision, document_type, scenario, canonical_document, supplier_snapshot, buyer_snapshot, readiness_result, status)
values ('6e111111-1111-4111-8111-111111111111', '6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '6a111111-1111-4111-8111-111111111111', 0, 'invoice', 'b2b_invoice', '{"id":"canonical"}', '{"party":"supplier"}', '{"party":"buyer"}', '{"ready":true,"diagnostics":[]}', 'ready');
select is((select count(*) from public.e_invoice_documents), 1::bigint, 'owner reads its preparation document');
select is((select status from public.invoices where id = '6a111111-1111-4111-8111-111111111111'), 'draft', 'preparation does not change invoice payment status');
select throws_ok($$insert into public.e_invoice_documents (business_id, source_invoice_id, source_invoice_revision, document_type, scenario, supplier_snapshot, buyer_snapshot, readiness_result, status) values ('6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '6b222222-2222-4222-8222-222222222222', 0, 'invoice', 'b2b_invoice', '{}', '{}', '{"ready":false}', 'needs_information')$$, '23514', 'cross-business e-invoice source is not allowed', 'cross-business source links are rejected');
select lives_ok($$select public.save_e_invoice_supplemental_fields('6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '6e111111-1111-4111-8111-111111111111', 0, '{"customs":"C1"}')$$, 'current supplemental revision is saved');
select throws_ok($$select public.save_e_invoice_supplemental_fields('6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '6e111111-1111-4111-8111-111111111111', 0, '{}')$$, '40001', 'stale or immutable e-invoice preparation revision', 'stale supplemental write is rejected');

select set_config('request.jwt.claim.sub', '63333333-3333-4333-8333-333333333333', true);
select is((select count(*) from public.e_invoice_documents), 1::bigint, 'viewer can read preparation documents');
select throws_ok($$select public.save_e_invoice_supplemental_fields('6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '6e111111-1111-4111-8111-111111111111', 1, '{}')$$, '42501', 'e-invoice write permission is required', 'viewer cannot modify preparation documents');

select set_config('request.jwt.claim.sub', '62222222-2222-4222-8222-222222222222', true);
select is((select count(*) from public.e_invoice_documents), 0::bigint, 'another business cannot read preparation documents');

select set_config('request.jwt.claim.sub', '61111111-1111-4111-8111-111111111111', true);
select lives_ok($$select public.approve_e_invoice_document('6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '6e111111-1111-4111-8111-111111111111', 1, '{"ready":true,"diagnostics":[],"validatedAt":"2026-07-17T10:00:00Z","checkLabel":"NiagaAI internal preparation checks"}')$$, 'owner approves the current ready revision');
select throws_ok($$update public.e_invoice_documents set supplier_snapshot = '{}' where id = '6e111111-1111-4111-8111-111111111111'$$, '23514', 'approved e-invoice preparation revisions are immutable', 'approved snapshots remain immutable');
select lives_ok($$select public.create_e_invoice_revision('6aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '6e111111-1111-4111-8111-111111111111')$$, 'editing after approval creates a new revision');
select ok(not (select active or submission_eligible from public.e_invoice_documents where id = '6e111111-1111-4111-8111-111111111111'), 'superseded approval is no longer active or submission eligible');
select is((select count(*) from public.e_invoice_documents where active and status = 'ready' and supersedes_document_id = '6e111111-1111-4111-8111-111111111111'), 1::bigint, 'new revision is active and retains an immutable history link');

select * from finish();
rollback;
