-- Older connection setup stored bare environment-variable names. Normalize
-- them to the scoped opaque-reference format required by the secret provider.

update public.myinvois_connections
set client_id_secret_ref = 'env:' || environment || ':' || client_id_secret_ref,
    updated_at = now()
where client_id_secret_ref ~ '^[A-Z][A-Z0-9_]*$';

update public.myinvois_connections
set client_secret_secret_ref = 'env:' || environment || ':' || client_secret_secret_ref,
    updated_at = now()
where client_secret_secret_ref ~ '^[A-Z][A-Z0-9_]*$';
