-- Allow direct taxpayer-system credentials alongside intermediary delegation.

alter table public.myinvois_connections
  drop constraint myinvois_connections_auth_mode_check;

alter table public.myinvois_connections
  add constraint myinvois_connections_auth_mode_check
  check (auth_mode in ('taxpayer', 'intermediary'));
