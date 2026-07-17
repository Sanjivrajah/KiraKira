alter table public.businesses
  drop constraint if exists businesses_msic_code_check;

alter table public.businesses
  add constraint businesses_msic_code_check
  check (msic_code is null or msic_code ~ '^[0-9]{5}$');

comment on constraint businesses_msic_code_check on public.businesses is
  'MSIC is exactly five ASCII digits. The explicit range avoids PostgreSQL regular-expression escape ambiguity.';
