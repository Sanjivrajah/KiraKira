create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_timestamp_utc()
returns timestamptz
language sql
stable
as $$ select now() $$;

comment on function public.set_updated_at() is 'Keeps mutable application records current without trusting client clocks.';
