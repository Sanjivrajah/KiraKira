begin;
select plan(21);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('66666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'crud@example.test', 'x', now(), now(), now());
insert into public.businesses (id, owner_user_id, legal_name, entity_type)
values ('cccccccc-cccc-cccc-cccc-cccccccccccc', '66666666-6666-6666-6666-666666666666', 'CRUD Business', 'other');
insert into public.business_members (business_id, user_id, role, status, accepted_at)
values ('cccccccc-cccc-cccc-cccc-cccccccccccc', '66666666-6666-6666-6666-666666666666', 'owner', 'active', now());

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '66666666-6666-6666-6666-666666666666', true);

select lives_ok($$
  insert into public.transactions (
    id, business_id, direction, transaction_type, lifecycle, transaction_date, accounting_date,
    description, category_code, currency, subtotal_minor, discount_minor, tax_minor, total_minor,
    payment_status, e_invoice_treatment, source_links, lines, totals
  ) values (
    'cccccccc-0000-0000-0000-000000000001', 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'expense', 'expense', 'proposed', current_date, current_date, 'Created', 'general', 'MYR',
    1000, 0, 0, 1000, 'paid', 'undetermined', '[]', '[]', '{}'
  )
$$, 'authenticated owner can create a transaction');
select is((select count(*) from public.transactions where id = 'cccccccc-0000-0000-0000-000000000001'), 1::bigint, 'created transaction can be read');
select lives_ok($$update public.transactions set description = 'Updated', subtotal_minor = 1250, total_minor = 1250 where id = 'cccccccc-0000-0000-0000-000000000001'$$, 'authenticated owner can update a transaction');
select is((select description from public.transactions where id = 'cccccccc-0000-0000-0000-000000000001'), 'Updated', 'updated transaction is returned');
select lives_ok($$update public.transactions set lifecycle = 'voided', void_reason = 'Owner removed it' where id = 'cccccccc-0000-0000-0000-000000000001'$$, 'delete semantics void the financial record');
select is((select lifecycle from public.transactions where id = 'cccccccc-0000-0000-0000-000000000001'), 'voided', 'voided transaction remains auditable');
select is((select count(*) from public.transaction_status_history where transaction_id = 'cccccccc-0000-0000-0000-000000000001'), 2::bigint, 'create and void lifecycle history is recorded');
select is((select count(*) from public.audit_events where entity_id = 'cccccccc-0000-0000-0000-000000000001'), 3::bigint, 'create, update, and void audit events are recorded');

select lives_ok($$
  select public.save_invoice_draft(
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'cccccccc-3000-0000-0000-000000000001',
    '{"customer_snapshot":{"name":"Buyer"},"supplier_snapshot":{},"issue_date":"2026-07-16","due_date":"2026-07-30","currency":"MYR"}',
    '[{"description":"Discounted item","quantity":2,"unit_price_minor":1000,"discount_minor":100,"charge_minor":50,"tax_rate":10,"tax_type_code":"01"}]'
  )
$$, 'discounted invoice draft can be created');
select is((select total_minor from public.invoices where id = 'cccccccc-3000-0000-0000-000000000001'), 2145::bigint, 'invoice total includes discount, charge, and tax exactly once');
select lives_ok($$
  select public.save_invoice_draft(
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'cccccccc-3000-0000-0000-000000000001',
    '{"customer_snapshot":{"name":"Buyer"},"supplier_snapshot":{},"issue_date":"2026-07-16","due_date":"2026-07-30","currency":"MYR","notes":"Updated"}',
    '[{"description":"Discounted item","quantity":2,"unit_price_minor":1000,"discount_minor":100,"charge_minor":50,"tax_rate":10,"tax_type_code":"01"}]'
  )
$$, 'invoice draft can be updated atomically with its lines');
select lives_ok($$select public.issue_invoice('cccccccc-3000-0000-0000-000000000001')$$, 'invoice can be issued');
select lives_ok($$select public.record_invoice_payment('cccccccc-3000-0000-0000-000000000001', 2145, 'MYR', now(), 'cash', 'crud-payment')$$, 'issued invoice can receive a full payment');
select is((select status from public.invoices where id = 'cccccccc-3000-0000-0000-000000000001'), 'paid', 'full payment marks invoice paid');
insert into public.payment_reminders (id, business_id, invoice_id, scheduled_for, channel, message_snapshot, status)
values ('cccccccc-4000-0000-0000-000000000001', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'cccccccc-3000-0000-0000-000000000001', now(), 'email', 'Reminder', 'scheduled');
select is((select status from public.payment_reminders where id = 'cccccccc-4000-0000-0000-000000000001'), 'scheduled', 'reminder can be created and read');
select lives_ok($$update public.payment_reminders set message_snapshot = 'Updated reminder' where id = 'cccccccc-4000-0000-0000-000000000001'$$, 'reminder can be updated');
select lives_ok($$delete from public.payment_reminders where id = 'cccccccc-4000-0000-0000-000000000001'$$, 'reminder can be deleted');

reset role;
select set_config('request.jwt.claim.sub', '', true);
insert into public.telegram_accounts (id, user_id, business_id, telegram_user_id, telegram_chat_id, linked_at)
values ('cccccccc-1000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 123456, 123456, now());
insert into public.telegram_conversation_states (telegram_account_id, draft_id, draft, mode, expires_at)
values ('cccccccc-1000-0000-0000-000000000001', 'cccccccc-2000-0000-0000-000000000001', '{"id":"cccccccc-2000-0000-0000-000000000001","status":"pending"}', 'awaiting_review', now() + interval '1 hour');

set local role service_role;
select lives_ok($$
  select public.confirm_telegram_transaction(
    'cccccccc-1000-0000-0000-000000000001',
    'cccccccc-2000-0000-0000-000000000001',
    'telegram-confirm:crud',
    '{"id":"cccccccc-2000-0000-0000-000000000001","direction":"expense","transactionType":"expense","transactionDate":"2026-07-16","description":"Telegram CRUD","category":"general","amountMinor":500,"paymentMethod":"cash","sourceType":"telegram_text"}'
  )
$$, 'service-role worker can confirm a linked Telegram transaction');
select is((select lifecycle from public.transactions where id = 'cccccccc-2000-0000-0000-000000000001'), 'confirmed', 'Telegram confirmation creates a readable transaction');
select lives_ok($$select public.void_telegram_transaction('cccccccc-1000-0000-0000-000000000001', 'cccccccc-2000-0000-0000-000000000001', 'Undo')$$, 'service-role worker can undo its Telegram transaction');
select is((select lifecycle from public.transactions where id = 'cccccccc-2000-0000-0000-000000000001'), 'voided', 'Telegram undo persists the void');

select * from finish();
rollback;
