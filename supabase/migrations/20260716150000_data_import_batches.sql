-- Session 8: explicit, auditable one-time imports. Financial rows keep their
-- original source reference in external_key/confirmation; this table records
-- the import operation without creating a browser-storage fallback.
create table public.data_import_batches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  source_kind text not null check (source_kind in ('browser_local', 'telegram_json')),
  source_batch_id uuid not null,
  status text not null check (status in ('running', 'completed', 'completed_with_errors', 'failed')),
  requested_by uuid references public.profiles(id) on delete set null,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default public.current_timestamp_utc(),
  completed_at timestamptz,
  unique (business_id, source_kind, source_batch_id)
);

create index data_import_batches_business_created_idx on public.data_import_batches (business_id, created_at desc);

alter table public.data_import_batches enable row level security;

create policy data_import_batches_select on public.data_import_batches for select
  using (public.is_business_member(business_id));
create policy data_import_batches_insert on public.data_import_batches for insert
  with check (requested_by = auth.uid() and public.has_business_role(business_id, array['owner', 'admin', 'accountant', 'staff']));
create policy data_import_batches_update on public.data_import_batches for update
  using (requested_by = auth.uid() and public.has_business_role(business_id, array['owner', 'admin', 'accountant', 'staff']))
  with check (requested_by = auth.uid() and public.has_business_role(business_id, array['owner', 'admin', 'accountant', 'staff']));

grant select, insert, update on public.data_import_batches to authenticated;
