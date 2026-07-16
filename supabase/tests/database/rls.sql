begin;
select plan(18);

-- This pgTAP suite switches to the authenticated role and sets real JWT claims;
-- it never tests RLS through the database owner or service role.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.test', 'x', now(), now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@example.test', 'x', now(), now(), now()),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'viewer@example.test', 'x', now(), now(), now()),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@example.test', 'x', now(), now(), now()),
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'staff@example.test', 'x', now(), now(), now());
insert into public.businesses (id, owner_user_id, legal_name, entity_type) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'A Business', 'other'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'B Business', 'other');
insert into public.business_members (business_id, user_id, role, status, accepted_at) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner', 'active', now()),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'viewer', 'active', now()),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'admin', 'active', now()),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', 'staff', 'active', now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'owner', 'active', now());
-- Session 5's transaction audit trigger correctly requires an authenticated
-- actor. Seed the fixture with the owning user's claim before inserting it.
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
insert into public.transactions (id, business_id, direction, transaction_type, transaction_date, accounting_date, description, category_code, currency, subtotal_minor, total_minor, payment_status, e_invoice_treatment, lifecycle)
values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'expense', 'expense', current_date, current_date, 'Test transaction', 'general', 'MYR', 0, 0, 'unpaid', 'not_required', 'proposed');
insert into public.products_services (id, business_id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'B-only product');

set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is((select count(*) from public.businesses), 0::bigint, 'unauthenticated access returns no business rows');
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select is((select count(*) from public.businesses), 1::bigint, 'member sees only its business');
select is((select count(*) from public.transactions where business_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0::bigint, 'user A cannot see business B records');
select ok(public.is_business_member('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 'active member has access');
select throws_ok($$insert into public.business_members (business_id, user_id, role, status) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'owner', 'active')$$, '42501', 'permission denied for table business_members', 'arbitrary membership insert is denied');

select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
select results_eq($$update public.transactions set description = 'nope' where id = 'aaaaaaaa-0000-0000-0000-000000000000' returning id$$, $$select null::uuid where false$$, 'viewer cannot mutate');
select set_config('request.jwt.claim.sub', '55555555-5555-5555-5555-555555555555', true);
select throws_ok($$select public.upsert_business_member('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'staff', 'active')$$, '42501', 'business management permission is required', 'staff cannot elevate roles');

select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', true);
select throws_ok($$select public.upsert_business_member('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'owner', 'active')$$, '42501', 'admins cannot assign owner or admin roles', 'admin cannot perform owner-only action');

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select lives_ok($$select public.upsert_business_member('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'staff', 'active')$$, 'owner can manage an allowed member');
select throws_ok($$insert into public.transaction_line_items (transaction_id, product_service_id, line_number, description, quantity, unit_code, unit_price_minor, tax_type_code, tax_rate, tax_minor, subtotal_minor, total_minor) values ('aaaaaaaa-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000000', 1, 'cross tenant', 1, 'EA', 0, '00', 0, 0, 0, 0)$$, '23514', 'cross-business reference is not allowed', 'cross-business foreign-key trick fails');
select lives_ok($$select public.upsert_business_member('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'staff', 'suspended')$$, 'owner can suspend a member');
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select is((select count(*) from public.businesses where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 0::bigint, 'suspended member loses access');

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select lives_ok($$insert into storage.objects (bucket_id, name, owner_id) values ('transaction-evidence', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/transaction/aaaaaaaa-0000-0000-0000-000000000000/aaaaaaaa-1111-1111-1111-111111111111.png', '11111111-1111-1111-1111-111111111111')$$, 'business member can upload to its private evidence prefix');
select throws_ok($$insert into storage.objects (bucket_id, name, owner_id) values ('transaction-evidence', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/transaction/aaaaaaaa-0000-0000-0000-000000000000/bbbbbbbb-1111-1111-1111-111111111111.png', '11111111-1111-1111-1111-111111111111')$$, '42501', null, 'cross-business evidence upload is denied');
select throws_ok($$insert into storage.objects (bucket_id, name, owner_id) values ('invoice-documents', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/transaction/aaaaaaaa-0000-0000-0000-000000000000/bbbbbbbb-1111-1111-1111-111111111111.png', '11111111-1111-1111-1111-111111111111')$$, '42501', null, 'transaction evidence cannot be uploaded into the invoice bucket');
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select is((select count(*) from storage.objects where bucket_id = 'transaction-evidence'), 0::bigint, 'business B cannot read business A evidence object');
select throws_ok($$insert into storage.objects (bucket_id, name, owner_id) values ('transaction-evidence', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/transaction/aaaaaaaa-0000-0000-0000-000000000000/cccccccc-1111-1111-1111-111111111111.png', '22222222-2222-2222-2222-222222222222')$$, '42501', null, 'business B cannot upload into business A prefix');
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
select is(public.can_delete_evidence_object('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/transaction/aaaaaaaa-0000-0000-0000-000000000000/aaaaaaaa-1111-1111-1111-111111111111.png'), false, 'viewer cannot delete evidence object');
select * from finish();
rollback;
