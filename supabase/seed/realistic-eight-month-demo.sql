-- Synthetic demo data only. Never apply this to a production customer account.
--
-- Before running, replace __OWNER_EMAIL__ below with a real auth.users email.
-- The script is deliberately not configured as the automatic `supabase db reset`
-- seed because it must attach records to an existing authenticated user.

begin;

do $$
declare
  v_owner_email constant text := 'sanjivrajah1@gmail.com';
  v_owner_id uuid;
  v_business_id uuid;
  v_party_id uuid;
  v_invoice_id uuid;
  v_transaction_id uuid;
  v_issue_date date;
  v_activity_date date;
  v_payment_date date;
  v_invoice_number integer := 0;
  v_draft_number integer := 0;
  v_sale_number integer := 0;
  v_subtotal bigint;
  v_paid_amount bigint;
  v_status text;
  v_customer record;
  v_supplier record;
  v_product record;
  v_description text;
  v_amount bigint;
  v_customer_tin text;
  v_customer_registration text;
begin
  if v_owner_email = '__OWNER_EMAIL__' then
    raise exception 'Replace __OWNER_EMAIL__ with the email of the intended demo account before running this script.';
  end if;

  select id into v_owner_id from auth.users where lower(email) = lower(v_owner_email);
  if v_owner_id is null then
    raise exception 'No auth user exists for %; create the account through Supabase Auth first.', v_owner_email;
  end if;

  -- Makes lifecycle/audit triggers attribute fixture rows to the selected user.
  perform set_config('request.jwt.claim.sub', v_owner_id::text, true);

  insert into public.profiles (id, display_name, preferred_language, timezone)
  values (v_owner_id, 'Mei Lin Tan', 'en', 'Asia/Kuala_Lumpur')
  on conflict (id) do nothing;

  select id into v_business_id
  from public.businesses
  where owner_user_id = v_owner_id and legal_name = 'Orchid Moon Kitchen Enterprise'
  limit 1;

  if v_business_id is null then
    insert into public.businesses (
      owner_user_id, legal_name, trading_name, entity_type, default_currency,
      preferred_language, timezone, msic_code, business_activity_description,
      created_by, updated_by
    ) values (
      v_owner_id, 'Orchid Moon Kitchen Enterprise', 'Orchid Moon Kitchen',
      'sole_proprietorship', 'MYR', 'en', 'Asia/Kuala_Lumpur', '56101',
      'Contemporary Chinese-inspired meal prep, office lunches and event catering.',
      v_owner_id, v_owner_id
    ) returning id into v_business_id;
  end if;

  insert into public.business_members (business_id, user_id, role, status, accepted_at)
  values (v_business_id, v_owner_id, 'owner', 'active', now())
  on conflict (business_id, user_id) do update
    set role = 'owner', status = 'active', accepted_at = coalesce(public.business_members.accepted_at, excluded.accepted_at);

  insert into public.business_settings (business_id, invoice_number_prefix, invoice_number_next, default_payment_terms_days)
  values (v_business_id, 'OMK-', 82, 14)
  on conflict (business_id) do nothing;

  insert into public.business_addresses (business_id, address_type, line1, city, state_code, postal_code, country_code, is_primary)
  select v_business_id, 'registered', '18, Jalan Sri Permaisuri 3', 'Kuala Lumpur', '14', '56000', 'MY', true
  where not exists (select 1 from public.business_addresses where business_id = v_business_id and is_primary);

  update public.business_tax_identifiers
  set value = 'C209999990', issuing_country_code = 'MY', description = 'Synthetic demo TIN — not valid for MyInvois submission', is_primary = true
  where business_id = v_business_id and scheme = 'tin';
  if not found then
    insert into public.business_tax_identifiers (business_id, scheme, value, issuing_country_code, description, is_primary)
    values (v_business_id, 'tin', 'C209999990', 'MY', 'Synthetic demo TIN — not valid for MyInvois submission', true);
  end if;
  update public.business_registration_identifiers
  set value = '202601009999', issuing_country_code = 'MY', description = 'Synthetic demo BRN — not valid for MyInvois submission', is_primary = true
  where business_id = v_business_id and is_primary;
  if not found then
    insert into public.business_registration_identifiers (business_id, scheme, value, issuing_country_code, description, is_primary)
    values (v_business_id, 'brn', '202601009999', 'MY', 'Synthetic demo BRN — not valid for MyInvois submission', true);
  end if;
  update public.business_contacts set value = 'hello@orchidmoonkitchen.demo', is_primary = true
  where business_id = v_business_id and contact_type = 'email';
  if not found then insert into public.business_contacts (business_id, contact_type, value, label, is_primary)
    values (v_business_id, 'email', 'hello@orchidmoonkitchen.demo', 'Primary email', true); end if;
  update public.business_contacts set value = '+60 3-6201 8842', is_primary = true
  where business_id = v_business_id and contact_type = 'phone';
  if not found then insert into public.business_contacts (business_id, contact_type, value, label, is_primary)
    values (v_business_id, 'phone', '+60 3-6201 8842', 'Primary phone', true); end if;

  insert into public.parties (business_id, kind, legal_name, trading_name, roles, email, phone, default_currency, default_payment_terms_days, created_by, updated_by)
  select v_business_id, source.kind, source.legal_name, source.trading_name, source.roles, source.email, source.phone, 'MYR', source.terms, v_owner_id, v_owner_id
  from (values
    ('business', 'Brightline Workspace Sdn. Bhd.', 'Brightline', array['customer','buyer','payer']::text[], 'accounts@brightline.example', '+60 3-2781 4120', 14),
    ('business', 'Northfield Academy Sdn. Bhd.', 'Northfield Academy', array['customer','buyer','payer']::text[], 'finance@northfield.example', '+60 3-7982 2034', 14),
    ('business', 'Meridian Care Clinic', 'Meridian Care', array['customer','buyer','payer']::text[], 'admin@meridiancare.example', '+60 3-4297 6810', 14),
    ('business', 'Loom & Line Studio', 'Loom & Line', array['customer','buyer','payer']::text[], 'hello@loomline.example', '+60 12-761 2840', 14),
    ('business', 'Maple Grove Residents Association', 'Maple Grove', array['customer','buyer','payer']::text[], 'finance@maplegrove.example', '+60 12-355 9812', 14),
    ('business', 'Amber Lantern Events', 'Amber Lantern', array['customer','buyer','payer']::text[], 'events@amberlantern.example', '+60 16-402 3177', 14),
    ('business', 'Crescent Desk Collective', 'Crescent Desk', array['customer','buyer','payer']::text[], 'accounts@crescentdesk.example', '+60 3-2282 7845', 14),
    ('business', 'Eastgate Properties Sdn. Bhd.', 'Eastgate Properties', array['customer','buyer','payer','supplier','seller','payee']::text[], 'leasing@eastgate.example', '+60 3-7981 1122', 30),
    ('business', 'Xin Yuan Fresh Market', 'Xin Yuan Fresh', array['supplier','seller','payee']::text[], 'orders@xinyuanfresh.example', '+60 3-6138 4412', 7),
    ('business', 'Heng Fatt Provisions Trading', 'Heng Fatt Provisions', array['supplier','seller','payee']::text[], 'sales@hengfatt.example', '+60 3-2148 5531', 14),
    ('business', 'Moonbean Coffee Roasters', 'Moonbean Coffee', array['supplier','seller','payee']::text[], 'orders@moonbean.example', '+60 12-242 8104', 14),
    ('business', 'Packwell Supply Enterprise', 'Packwell Supply', array['supplier','seller','payee']::text[], 'sales@packwell.example', '+60 3-7845 2038', 14),
    ('business', 'Velocity Fuel & Service', 'Velocity Fuel', array['supplier','seller','payee']::text[], 'station@velocityfuel.example', '+60 3-8941 9021', 0),
    ('business', 'BrightGrid Utilities', 'BrightGrid', array['supplier','seller','payee']::text[], 'billing@brightgrid.example', '+60 3-8922 2222', 14),
    ('business', 'Clearwater Utilities', 'Clearwater', array['supplier','seller','payee']::text[], 'billing@clearwater.example', '+60 3-5650 8800', 14),
    ('business', 'Nexus Fibre Business', 'Nexus Fibre', array['supplier','seller','payee']::text[], 'billing@nexusfibre.example', '+60 3-7492 2123', 14),
    ('business', 'Sophie Lim Wei Qi', 'Sophie Lim', array['supplier','payee']::text[], 'sophie.lim@example', '+60 12-686 7310', 0)
  ) as source(kind, legal_name, trading_name, roles, email, phone, terms)
  where not exists (select 1 from public.parties p where p.business_id = v_business_id and p.legal_name = source.legal_name);

  -- Every demo customer uses the configured sandbox taxpayer TIN so generated
  -- e-Invoice fixtures remain internally consistent with sandbox credentials.
  with numbered_parties as (
    select id, row_number() over (order by legal_name) as sequence
    from public.parties where business_id = v_business_id
  )
  update public.party_tax_identifiers identifier
  set value = 'IG40365782020', issuing_country_code = 'MY', description = 'Sandbox test taxpayer TIN supplied for this demo'
  from public.parties party
  where identifier.party_id = party.id and identifier.scheme = 'tin' and party.business_id = v_business_id and party.roles ? 'customer';
  insert into public.party_tax_identifiers (party_id, scheme, value, issuing_country_code, description)
  select id, 'tin', 'IG40365782020', 'MY', 'Sandbox test taxpayer TIN supplied for this demo'
  from numbered_parties
  where exists (select 1 from public.parties party where party.id = numbered_parties.id and party.roles ? 'customer')
    and not exists (select 1 from public.party_tax_identifiers identifier where identifier.party_id = numbered_parties.id and identifier.scheme = 'tin');
  with numbered_parties as (
    select id, row_number() over (order by legal_name) as sequence
    from public.parties where business_id = v_business_id
  )
  insert into public.party_registration_identifiers (party_id, scheme, value, issuing_country_code, description)
  select id, 'brn', '202601' || lpad(sequence::text, 6, '0'), 'MY', 'Synthetic demo BRN — not valid for MyInvois submission'
  from numbered_parties
  on conflict (party_id, scheme, value) do update set issuing_country_code = excluded.issuing_country_code, description = excluded.description;
  with numbered_parties as (
    select id, row_number() over (order by legal_name) as sequence
    from public.parties where business_id = v_business_id
  ), details as (
    select id,
      case sequence
        when 1 then '12-3, Jalan SS 2/67' when 2 then '21, Jalan Tun Razak' when 3 then 'Level 8, Menara Aria, Jalan Ampang'
        when 4 then '27, Jalan Medan Setia 2' when 5 then '35, Jalan Kiara 3' when 6 then 'Level 4, The Square, Jalan 17/56'
        when 7 then '18, Jalan 19/70A' when 8 then '10, Jalan Solaris 3' when 9 then 'Lot 18, Jalan 1/149'
        when 10 then '62, Jalan Pudu Ulu' when 11 then '9, Jalan Kuchai Lama' when 12 then '2, Jalan Radin Bagus 3'
        when 13 then 'Unit 6, Jalan 13/2' when 14 then '31, Jalan Taman Ikan Emas' when 15 then '17, Jalan 1/116B'
        when 16 then 'A-3-12, Jalan Damanlela' else '28, Jalan Bangsar Utama 9' end as line1,
      case when sequence in (3, 4, 5, 10, 12, 16) then 'Kuala Lumpur' else 'Petaling Jaya' end as city,
      case when sequence in (3, 4, 5, 10, 12, 16) then '14' else '10' end as state_code,
      lpad((50000 + sequence * 100)::text, 5, '0') as postal_code
    from numbered_parties
  )
  update public.party_addresses address
  set line1 = details.line1, city = details.city, state_code = details.state_code, postal_code = details.postal_code, country_code = 'MY', is_primary = true
  from details where address.party_id = details.id and address.address_type = 'billing';
  with numbered_parties as (
    select id, row_number() over (order by legal_name) as sequence
    from public.parties where business_id = v_business_id
  )
  insert into public.party_addresses (party_id, address_type, line1, city, state_code, postal_code, country_code, is_primary)
  select id, 'billing', 'Suite ' || sequence || ', Demo Commerce Centre', 'Kuala Lumpur', '14', lpad((50000 + sequence * 10)::text, 5, '0'), 'MY', true
  from numbered_parties numbered
  where not exists (select 1 from public.party_addresses address where address.party_id = numbered.id and address.address_type = 'billing');

  insert into public.products_services (business_id, name, description, sku, classification_code, unit_code, default_unit_price_minor, currency, tax_type_code, tax_rate)
  select v_business_id, source.name, source.description, source.sku, '022', 'C62', source.price, 'MYR', '01', 0
  from (values
    ('Soy-Garlic Chicken Rice Set', 'Roasted chicken, fragrant rice and seasonal greens', 'OMK-BRK-001', 1280),
    ('Office Bento Collection', 'Chinese-inspired lunch box for office delivery', 'OMK-LCH-001', 2200),
    ('Tea & Pastry Meeting Box', 'Egg tarts, savoury pastries and tea for meetings', 'OMK-TEA-001', 1500),
    ('Modern Chinese Buffet', 'Family-style buffet catering per guest', 'OMK-CAT-001', 3800),
    ('Coffee & Egg Tart Station', 'Fresh coffee with warm egg tarts', 'OMK-COF-001', 1100),
    ('Delivery and Setup', 'Delivery, setup and collection within Klang Valley', 'OMK-DEL-001', 6500),
    ('Custom Celebration Menu', 'Customised menu planning and service', 'OMK-EVT-001', 5200)
  ) as source(name, description, sku, price)
  where not exists (select 1 from public.products_services ps where ps.business_id = v_business_id and ps.sku = source.sku);

  -- 81 invoices, issued every third day. Older invoices are mostly settled,
  -- while a realistic minority remains outstanding or partially settled.
  for v_issue_date in select generate_series(date '2025-11-01', date '2026-06-30', interval '3 days')::date loop
    v_invoice_number := v_invoice_number + 1;
    select * into v_customer from public.parties
      where business_id = v_business_id and 'customer' = any(roles)
      order by legal_name offset ((v_invoice_number - 1) % 8) limit 1;
    select * into v_product from public.products_services
      where business_id = v_business_id
      order by sku offset ((v_invoice_number - 1) % 7) limit 1;
    select value into v_customer_tin from public.party_tax_identifiers
      where party_id = v_customer.id and scheme = 'tin' order by value limit 1;
    select value into v_customer_registration from public.party_registration_identifiers
      where party_id = v_customer.id order by value limit 1;
    v_subtotal := (12 + (v_invoice_number % 4) * 6) * v_product.default_unit_price_minor;
    v_status := case
      when v_invoice_number % 13 = 0 then 'sent'
      when v_invoice_number % 9 = 0 then 'partially_paid'
      else 'paid'
    end;
    v_paid_amount := case when v_status = 'paid' then v_subtotal when v_status = 'partially_paid' then v_subtotal / 2 else 0 end;

    insert into public.invoices (
      business_id, invoice_number, customer_id, customer_snapshot, supplier_snapshot,
      issue_date, due_date, currency, status, subtotal_minor, discount_minor,
      tax_minor, rounding_minor, total_minor, amount_paid_minor, payment_terms,
      notes, issued_at, created_by, updated_by
    ) values (
      v_business_id, format('OMK-DEMO-%s', lpad(v_invoice_number::text, 4, '0')),
      v_customer.id,
      jsonb_build_object('name', v_customer.legal_name, 'legal_name', v_customer.legal_name, 'trading_name', v_customer.trading_name, 'email', v_customer.email, 'phone', v_customer.phone, 'tin', v_customer_tin, 'registration_number', v_customer_registration, 'registration_scheme', 'brn', 'country_code', 'MY'),
      jsonb_build_object('name', 'Orchid Moon Kitchen Enterprise', 'legal_name', 'Orchid Moon Kitchen Enterprise', 'trading_name', 'Orchid Moon Kitchen', 'email', 'hello@orchidmoonkitchen.demo', 'phone', '+60 3-6201 8842', 'tin', 'C209999990', 'registration_number', '202601009999', 'registration_scheme', 'brn', 'currency', 'MYR', 'country_code', 'MY'),
      v_issue_date, v_issue_date + 14, 'MYR', v_status, v_subtotal, 0, 0, 0,
      v_subtotal, v_paid_amount, 'Payment due within 14 days.',
      case when v_invoice_number % 5 = 0 then 'Please quote the invoice number with your transfer.' else 'Thank you for your order.' end,
      v_issue_date::timestamptz + interval '9 hours', v_owner_id, v_owner_id
    ) on conflict (business_id, invoice_number) do nothing;

    select id into v_invoice_id from public.invoices
      where business_id = v_business_id and invoice_number = format('OMK-DEMO-%s', lpad(v_invoice_number::text, 4, '0'));
    insert into public.invoice_items (invoice_id, line_number, product_service_id, description, quantity, unit_code, unit_price_minor, tax_type_code, tax_rate, tax_minor, subtotal_minor, total_minor, classification_code)
    values (v_invoice_id, 1, v_product.id, v_product.name, (12 + (v_invoice_number % 4) * 6), 'C62', v_product.default_unit_price_minor, '01', 0, 0, v_subtotal, v_subtotal, '022')
    on conflict (invoice_id, line_number) do nothing;

    if v_paid_amount > 0 then
      v_payment_date := v_issue_date + case when v_status = 'paid' then 7 else 10 end;
      insert into public.transactions (
        business_id, direction, transaction_type, lifecycle, occurred_at, transaction_date, accounting_date,
        counterparty_id, counterparty_name_snapshot, description, category_code, currency,
        subtotal_minor, discount_minor, tax_minor, total_minor, payment_status, payment_method_code,
        e_invoice_treatment, source_provenance, external_key, confidence_score, confirmed_at, confirmed_by,
        source_links, lines, totals, created_by, updated_by
      ) values (
        v_business_id, 'income', 'customer_payment', 'confirmed', v_payment_date::timestamptz + interval '11 hours', v_payment_date, v_payment_date,
        v_customer.id, v_customer.legal_name, format('Payment received for OMK-DEMO-%s', lpad(v_invoice_number::text, 4, '0')), 'customer_payment', 'MYR',
        v_paid_amount, 0, 0, v_paid_amount, 'paid', case when v_invoice_number % 3 = 0 then 'duitnow' else 'bank_transfer' end,
        'not_required', 'external_system', format('omk-demo-payment-%s', v_invoice_number), 1, v_payment_date::timestamptz + interval '11 hours', v_owner_id,
        '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, v_owner_id, v_owner_id
      ) on conflict do nothing;
      select id into v_transaction_id from public.transactions where business_id = v_business_id and external_key = format('omk-demo-payment-%s', v_invoice_number);
      insert into public.invoice_payments (invoice_id, transaction_id, amount_minor, currency, paid_at, payment_method_code, external_reference)
      values (v_invoice_id, v_transaction_id, v_paid_amount, 'MYR', v_payment_date::timestamptz + interval '11 hours', case when v_invoice_number % 3 = 0 then 'duitnow' else 'bank_transfer' end, format('OMK-PAY-%s', lpad(v_invoice_number::text, 4, '0')))
      on conflict (invoice_id, external_reference) do nothing;
    end if;
  end loop;

  -- Six current unissued quotes/order confirmations. They intentionally have
  -- no payment records and remain editable as drafts in the invoice workspace.
  for v_draft_number in 1..6 loop
    select * into v_customer from public.parties
      where business_id = v_business_id and 'customer' = any(roles)
      order by legal_name offset ((v_draft_number + 2) % 8) limit 1;
    select * into v_product from public.products_services
      where business_id = v_business_id
      order by sku offset ((v_draft_number + 3) % 7) limit 1;
    select value into v_customer_tin from public.party_tax_identifiers
      where party_id = v_customer.id and scheme = 'tin' order by value limit 1;
    select value into v_customer_registration from public.party_registration_identifiers
      where party_id = v_customer.id order by value limit 1;
    v_subtotal := (8 + v_draft_number * 4) * v_product.default_unit_price_minor;

    insert into public.invoices (
      business_id, invoice_number, customer_id, customer_snapshot, supplier_snapshot,
      issue_date, due_date, currency, status, subtotal_minor, discount_minor,
      tax_minor, rounding_minor, total_minor, amount_paid_minor, payment_terms,
      notes, created_by, updated_by
    ) values (
      v_business_id, format('DRAFT-OMK-%s', lpad(v_draft_number::text, 4, '0')),
      v_customer.id,
      jsonb_build_object('name', v_customer.legal_name, 'legal_name', v_customer.legal_name, 'trading_name', v_customer.trading_name, 'email', v_customer.email, 'phone', v_customer.phone, 'tin', v_customer_tin, 'registration_number', v_customer_registration, 'registration_scheme', 'brn', 'country_code', 'MY'),
      jsonb_build_object('name', 'Orchid Moon Kitchen Enterprise', 'legal_name', 'Orchid Moon Kitchen Enterprise', 'trading_name', 'Orchid Moon Kitchen', 'email', 'hello@orchidmoonkitchen.demo', 'phone', '+60 3-6201 8842', 'tin', 'C209999990', 'registration_number', '202601009999', 'registration_scheme', 'brn', 'currency', 'MYR', 'country_code', 'MY'),
      date '2026-06-19' + v_draft_number, date '2026-07-03' + v_draft_number, 'MYR', 'draft', v_subtotal, 0, 0, 0,
      v_subtotal, 0, 'Payment due within 14 days after invoice issue.',
      case when v_draft_number % 2 = 0 then 'Awaiting final guest count before issue.' else 'Draft prepared for customer review.' end,
      v_owner_id, v_owner_id
    ) on conflict (business_id, invoice_number) do nothing;

    select id into v_invoice_id from public.invoices
      where business_id = v_business_id and invoice_number = format('DRAFT-OMK-%s', lpad(v_draft_number::text, 4, '0'));
    insert into public.invoice_items (invoice_id, line_number, product_service_id, description, quantity, unit_code, unit_price_minor, tax_type_code, tax_rate, tax_minor, subtotal_minor, total_minor, classification_code)
    values (v_invoice_id, 1, v_product.id, v_product.name, (8 + v_draft_number * 4), 'C62', v_product.default_unit_price_minor, '01', 0, 0, v_subtotal, v_subtotal, '022')
    on conflict (invoice_id, line_number) do nothing;
  end loop;

  -- Daily operating costs, cash sales, and regular overhead. These variations
  -- make monthly trends look like a working food-and-catering business.
  for v_activity_date in select generate_series(date '2025-11-01', date '2026-06-30', interval '1 day')::date loop
    if extract(isodow from v_activity_date) between 1 and 6 then
      select * into v_supplier from public.parties where business_id = v_business_id and legal_name = case
        when extract(isodow from v_activity_date) in (1, 4) then 'Xin Yuan Fresh Market'
        when extract(isodow from v_activity_date) in (2, 5) then 'Heng Fatt Provisions Trading'
        else 'Packwell Supply Enterprise' end;
      v_amount := case when v_supplier.legal_name = 'Xin Yuan Fresh Market' then 18500 + ((extract(day from v_activity_date)::int % 6) * 3750)
        when v_supplier.legal_name = 'Heng Fatt Provisions Trading' then 9200 + ((extract(day from v_activity_date)::int % 5) * 2400)
        else 4800 + ((extract(day from v_activity_date)::int % 4) * 1250) end;
      v_description := case when v_supplier.legal_name = 'Xin Yuan Fresh Market' then 'Fresh produce, poultry and seasonal greens for kitchen prep'
        when v_supplier.legal_name = 'Heng Fatt Provisions Trading' then 'Rice, sauces, tea and dry-goods restock'
        else 'Food containers, cups and packing materials' end;
      insert into public.transactions (business_id, direction, transaction_type, lifecycle, occurred_at, transaction_date, accounting_date, counterparty_id, counterparty_name_snapshot, description, category_code, currency, subtotal_minor, discount_minor, tax_minor, total_minor, payment_status, payment_method_code, e_invoice_treatment, source_provenance, external_key, confidence_score, confirmed_at, confirmed_by, source_links, lines, totals, created_by, updated_by)
      values (v_business_id, 'expense', 'expense', 'confirmed', v_activity_date::timestamptz + interval '7 hours', v_activity_date, v_activity_date, v_supplier.id, v_supplier.legal_name, v_description, 'cost_of_sales', 'MYR', v_amount, 0, 0, v_amount, 'paid', case when extract(day from v_activity_date)::int % 3 = 0 then 'cash' else 'duitnow' end, 'not_required', 'receipt', format('omk-demo-cost-%s', v_activity_date), 0.98, v_activity_date::timestamptz + interval '7 hours', v_owner_id, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, v_owner_id, v_owner_id)
      on conflict do nothing;
    end if;

    if extract(isodow from v_activity_date) in (2, 5) then
      select * into v_supplier from public.parties where business_id = v_business_id and legal_name = 'Velocity Fuel & Service';
      v_amount := 7800 + ((extract(day from v_activity_date)::int % 5) * 1350);
      v_description := 'Fuel for catering delivery and supplier collection runs';
      insert into public.transactions (business_id, direction, transaction_type, lifecycle, occurred_at, transaction_date, accounting_date, counterparty_id, counterparty_name_snapshot, description, category_code, currency, subtotal_minor, discount_minor, tax_minor, total_minor, payment_status, payment_method_code, e_invoice_treatment, source_provenance, external_key, confidence_score, confirmed_at, confirmed_by, source_links, lines, totals, created_by, updated_by)
      values (v_business_id, 'expense', 'expense', 'confirmed', v_activity_date::timestamptz + interval '16 hours', v_activity_date, v_activity_date, v_supplier.id, v_supplier.legal_name, v_description, 'transport', 'MYR', v_amount, 0, 0, v_amount, 'paid', 'card', 'not_required', 'receipt', format('omk-demo-fuel-%s', v_activity_date), 0.99, v_activity_date::timestamptz + interval '16 hours', v_owner_id, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, v_owner_id, v_owner_id)
      on conflict do nothing;
    end if;

    -- Daily paid counter sales keep this synthetic business cash-positive while
    -- retaining regular cost-of-sales, transport, rent, payroll, and utilities.
    if extract(isodow from v_activity_date) between 1 and 6 then
      v_sale_number := v_sale_number + 1;
      v_amount := 48000 + ((v_sale_number % 7) * 6500);
      insert into public.transactions (business_id, direction, transaction_type, lifecycle, occurred_at, transaction_date, accounting_date, counterparty_name_snapshot, description, category_code, currency, subtotal_minor, discount_minor, tax_minor, total_minor, payment_status, payment_method_code, e_invoice_treatment, source_provenance, external_key, confidence_score, confirmed_at, confirmed_by, source_links, lines, totals, created_by, updated_by)
      values (v_business_id, 'income', 'sale', 'confirmed', v_activity_date::timestamptz + interval '13 hours', v_activity_date, v_activity_date, 'Walk-in customers', 'Counter sales: rice bowls, pastries and drinks', 'food_sales', 'MYR', v_amount, 0, 0, v_amount, 'paid', case when v_sale_number % 2 = 0 then 'cash' else 'duitnow' end, 'consolidated_candidate', 'manual', format('omk-demo-counter-%s', v_activity_date), 1, v_activity_date::timestamptz + interval '13 hours', v_owner_id, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, v_owner_id, v_owner_id)
      on conflict do nothing;
    end if;

    if extract(day from v_activity_date) = 3 then
      select * into v_supplier from public.parties where business_id = v_business_id and legal_name = 'Eastgate Properties Sdn. Bhd.'; v_amount := 285000;
      v_description := 'Monthly kitchen and kiosk rental';
    elsif extract(day from v_activity_date) = 8 then
      select * into v_supplier from public.parties where business_id = v_business_id and legal_name = 'BrightGrid Utilities'; v_amount := 21800 + (extract(month from v_activity_date)::int % 4) * 1900;
      v_description := 'Electricity bill for kitchen operations';
    elsif extract(day from v_activity_date) = 12 then
      select * into v_supplier from public.parties where business_id = v_business_id and legal_name = 'Nexus Fibre Business'; v_amount := 18900;
      v_description := 'Business mobile and fibre service';
    elsif extract(day from v_activity_date) = 16 then
      select * into v_supplier from public.parties where business_id = v_business_id and legal_name = 'Clearwater Utilities'; v_amount := 8600 + (extract(month from v_activity_date)::int % 3) * 650;
      v_description := 'Water bill for food preparation premises';
    elsif extract(day from v_activity_date) = 25 then
      select * into v_supplier from public.parties where business_id = v_business_id and legal_name = 'Sophie Lim Wei Qi'; v_amount := 235000;
      v_description := 'Kitchen assistant monthly wages';
    else
      continue;
    end if;
    insert into public.transactions (business_id, direction, transaction_type, lifecycle, occurred_at, transaction_date, accounting_date, counterparty_id, counterparty_name_snapshot, description, category_code, currency, subtotal_minor, discount_minor, tax_minor, total_minor, payment_status, payment_method_code, e_invoice_treatment, source_provenance, external_key, confidence_score, confirmed_at, confirmed_by, source_links, lines, totals, created_by, updated_by)
    values (v_business_id, 'expense', 'expense', 'confirmed', v_activity_date::timestamptz + interval '10 hours', v_activity_date, v_activity_date, v_supplier.id, v_supplier.legal_name, v_description, case when extract(day from v_activity_date) = 3 then 'rent' when extract(day from v_activity_date) = 25 then 'payroll' else 'utilities' end, 'MYR', v_amount, 0, 0, v_amount, 'paid', 'bank_transfer', 'not_required', 'external_system', format('omk-demo-overhead-%s', v_activity_date), 1, v_activity_date::timestamptz + interval '10 hours', v_owner_id, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb, v_owner_id, v_owner_id)
    on conflict do nothing;
  end loop;

  -- Add normalized ledger lines for all fixture transactions that do not yet
  -- have one. This preserves the canonical transaction model, not just its UI
  -- compatibility JSON snapshots.
  insert into public.transaction_line_items (transaction_id, line_number, description, quantity, unit_code, unit_price_minor, tax_type_code, tax_rate, tax_minor, subtotal_minor, total_minor, classification_code)
  select t.id, 1, t.description, 1, 'C62', t.subtotal_minor, '01', 0, 0, t.subtotal_minor, t.total_minor, '022'
  from public.transactions t
  where t.business_id = v_business_id
    and t.external_key like 'omk-demo-%'
    and not exists (select 1 from public.transaction_line_items line where line.transaction_id = t.id and line.line_number = 1);

  raise notice 'Seed complete for Orchid Moon Kitchen Enterprise: % transactions, % invoices.',
    (select count(*) from public.transactions where business_id = v_business_id and external_key like 'omk-demo-%'),
    (select count(*) from public.invoices where business_id = v_business_id and invoice_number like 'OMK-DEMO-%');
end;
$$;

commit;
