create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  preferred_language text not null default 'en' check (preferred_language in ('en', 'ms')),
  timezone text not null default 'Asia/Kuala_Lumpur',
  created_at timestamptz not null default public.current_timestamp_utc(),
  updated_at timestamptz not null default public.current_timestamp_utc()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete restrict,
  legal_name text not null check (char_length(btrim(legal_name)) between 2 and 200),
  trading_name text check (trading_name is null or char_length(btrim(trading_name)) between 1 and 200),
  entity_type text not null check (entity_type in ('sole_proprietorship','partnership','limited_liability_partnership','private_limited_company','public_limited_company','association','government_entity','individual','foreign_entity','other')),
  default_currency char(3) not null default 'MYR' check (default_currency ~ '^[A-Z]{3}$'),
  preferred_language text not null default 'en' check (preferred_language in ('en', 'ms')),
  timezone text not null default 'Asia/Kuala_Lumpur',
  msic_code text check (msic_code is null or msic_code ~ '^\\d{5}$'),
  business_activity_description text check (business_activity_description is null or char_length(btrim(business_activity_description)) between 2 and 300),
  version integer not null default 0 check (version >= 0),
  created_at timestamptz not null default public.current_timestamp_utc(),
  updated_at timestamptz not null default public.current_timestamp_utc(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null
);

create table public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner','admin','accountant','staff','viewer')),
  status text not null default 'invited' check (status in ('invited','active','suspended','removed')),
  invited_by uuid references public.profiles(id) on delete set null,
  invited_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default public.current_timestamp_utc(),
  updated_at timestamptz not null default public.current_timestamp_utc(),
  primary key (business_id, user_id),
  check ((status <> 'active') or accepted_at is not null)
);

create unique index business_members_one_owner on public.business_members (business_id) where role = 'owner' and status = 'active';

create table public.business_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  invoice_number_prefix text not null default 'INV-' check (char_length(invoice_number_prefix) <= 30),
  invoice_number_next integer not null default 1 check (invoice_number_next > 0),
  default_payment_terms_days integer not null default 30 check (default_payment_terms_days between 0 and 3650),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default public.current_timestamp_utc(),
  updated_at timestamptz not null default public.current_timestamp_utc()
);

create table public.business_addresses (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  address_type text not null default 'registered' check (address_type in ('registered','billing','shipping','other')),
  line1 text not null, line2 text, line3 text, city text not null, state_code text, postal_code text, country_code char(2) not null default 'MY',
  is_primary boolean not null default false, created_at timestamptz not null default public.current_timestamp_utc(), updated_at timestamptz not null default public.current_timestamp_utc()
);
create unique index business_addresses_one_primary on public.business_addresses (business_id) where is_primary;

create table public.business_contacts (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  contact_type text not null check (contact_type in ('email','phone','website','other')), value text not null check (char_length(btrim(value)) between 1 and 300), label text,
  is_primary boolean not null default false, created_at timestamptz not null default public.current_timestamp_utc(), updated_at timestamptz not null default public.current_timestamp_utc()
);
create unique index business_contacts_one_primary_per_type on public.business_contacts (business_id, contact_type) where is_primary;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger businesses_set_updated_at before update on public.businesses for each row execute function public.set_updated_at();
create trigger business_members_set_updated_at before update on public.business_members for each row execute function public.set_updated_at();
create trigger business_settings_set_updated_at before update on public.business_settings for each row execute function public.set_updated_at();
create trigger business_addresses_set_updated_at before update on public.business_addresses for each row execute function public.set_updated_at();
create trigger business_contacts_set_updated_at before update on public.business_contacts for each row execute function public.set_updated_at();

create index businesses_owner_user_id_idx on public.businesses (owner_user_id);
create index business_members_user_business_idx on public.business_members (user_id, business_id) where status = 'active';
