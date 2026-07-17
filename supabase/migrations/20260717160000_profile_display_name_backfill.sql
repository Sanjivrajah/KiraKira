-- Keep the user-entered auth name as the profile display name for existing
-- accounts. Email local-parts are identifiers and must not become spoken names.
with auth_names as (
  select
    users.id,
    users.email,
    nullif(
      left(
        btrim(coalesce(users.raw_user_meta_data ->> 'name', users.raw_user_meta_data ->> 'full_name', '')),
        120
      ),
      ''
    ) as display_name
  from auth.users as users
)
update public.profiles as profiles
set display_name = auth_names.display_name
from auth_names
where profiles.id = auth_names.id
  and auth_names.display_name is not null
  and (
    profiles.display_name is null
    or btrim(profiles.display_name) = ''
    or lower(btrim(profiles.display_name)) = lower(split_part(coalesce(auth_names.email, ''), '@', 1))
  );

insert into public.profiles (id, display_name)
select
  users.id,
  nullif(
    left(
      btrim(coalesce(users.raw_user_meta_data ->> 'name', users.raw_user_meta_data ->> 'full_name', '')),
      120
    ),
    ''
  )
from auth.users as users
on conflict (id) do nothing;
